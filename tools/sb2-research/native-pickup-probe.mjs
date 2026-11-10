// Percorre corredores e escava pelo controle do jogo; não escreve memória.
import * as fs from 'node:fs/promises';

const directions = [[1, 0, 'RIGHT'], [-1, 0, 'LEFT'], [0, 1, 'DOWN'], [0, -1, 'UP']];
const key = ([x, y]) => `${x},${y}`;

export async function createPickupProbe(client, output, records = []) {
  await fs.mkdir(output, { recursive: true });
  let current;
  async function call(name, args = {}, label = name) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw Error(JSON.stringify(result));
    const content = [];
    for (const block of result.content) {
      if (block.type === 'image') {
        const path = `${output}/${label}.png`;
        await fs.writeFile(path, Buffer.from(block.data, 'base64'), { flag: 'wx' });
        content.push({ type: 'image', path });
      } else content.push(block);
    }
    records.push({ name, arguments: args, arena: 1, label, content });
    return JSON.parse(content[0].text);
  }
  async function read(label) {
    const response = await call('read_ram', {}, label);
    const ram = Buffer.from(response.hex, 'hex');
    const x = ram.readUInt16LE(0x8010) + ram.readUInt16LE(0x8012) / 65536;
    const y = ram.readUInt16LE(0x8018) + ram.readUInt16LE(0x801a) / 65536;
    const grid = Array.from({ length: 13 }, (_, y) => Array.from({ length: 15 }, (_, x) => ram.readUInt16LE(0x1c182 + y * 128 + x * 2)));
    const items = [];
    for (let y = 0; y < 13; y++) for (let x = 0; x < 15; x++) {
      if ((grid[y][x] & 63) === 4) items.push({ x, y, glyph: ram.readUInt16LE(0x1a0c2 + y * 64 + x * 2) });
    }
    current = { frame: response.frame, state: ram.readUInt16LE(0x8000), phase: ram.readUInt16LE(0x32),
      x, y, tile: [Math.floor((x - 8) / 16), Math.floor((y - 25) / 16)],
      speed: ram.readUInt16LE(0x80a0) + ram.readUInt16LE(0x80a2) / 65536,
      inventory: Array.from(ram.subarray(0x80e0, 0x8100)),
      secondPlayer: { alive: ram.readUInt16LE(0x8100) < 0x9800,
        tile: [Math.floor((ram.readUInt16LE(0x8110) - 8) / 16), Math.floor((ram.readUInt16LE(0x8118) - 25) / 16)] },
      bag: Array.from({ length: 64 }, (_, i) => ram.readUInt16LE(0x3c48 + i * 2)), grid, items };
    if (current.state >= 0x9800) throw Error(`Jogador deixou o estado vivo: ${label}`);
    return current;
  }
  const open = (x, y) => [0, 4].includes((current.grid[y]?.[x] ?? 5) & 63)
    && !current.items.some(item => item.x === x && item.y === y && item.glyph === 0x160a);
  function paths(start = current.tile) {
    const found = new Map([[key(start), [start]]]), queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const at = queue[index];
      for (const [dx, dy] of directions) {
        const next = [at[0] + dx, at[1] + dy];
        if (open(...next) && !found.has(key(next))) {
          found.set(key(next), [...found.get(key(at)), next]); queue.push(next);
        }
      }
    }
    return found;
  }
  async function walk(path, label) {
    for (let index = 1; index < path.length; index++) {
      const [x, y] = path[index], [px, py] = path[index - 1];
      const dx = x - px, dy = y - py;
      const target = dx ? 16 * x + 16 : 16 * y + 32;
      const actual = dx ? current.x : current.y;
      const frames = Math.max(1, Math.round(Math.abs(target - actual) / current.speed));
      await call('advance', { frames, buttons: [directions.find(row => row[0] === dx && row[1] === dy)[2]] }, label);
      await read(`${label}-move-${index}`);
      if (key(current.tile) !== key([x, y])) throw Error(`Destino não alcançado: ${label}`);
    }
  }
  function blast(at) {
    const cells = new Set([key(at)]);
    // E2 é o índice nativo; o alcance normal é índice + 1.
    const range = current.inventory[2] + 1;
    let blocks = 0;
    for (const [dx, dy] of directions) for (let step = 1; step <= range; step++) {
      const cell = [at[0] + dx * step, at[1] + dy * step];
      const value = (current.grid[cell[1]]?.[cell[0]] ?? 5) & 63;
      if ([5, 6].includes(value)) break;
      cells.add(key(cell));
      if (value === 2) { blocks++; break; }
      if ([3, 4].includes(value)) break;
    }
    return { cells, blocks };
  }
  async function dig(label) {
    const candidates = [];
    for (const path of paths().values()) {
      const at = path.at(-1), ray = blast(at);
      if (!ray.blocks || current.items.some(item => key([item.x, item.y]) === key(at))) continue;
      // Não destruir power-ups expostos ou atingir o segundo MAN parado.
      if (current.items.some(item => ray.cells.has(key([item.x, item.y])))
        || current.secondPlayer.alive && ray.cells.has(key(current.secondPlayer.tile))) continue;
      const escape = [...paths(at).values()].filter(route => !ray.cells.has(key(route.at(-1))))
        .sort((a, b) => a.length - b.length)[0];
      if (!escape || escape.length > 6) continue;
      candidates.push({ path, escape, blocks: ray.blocks });
    }
    candidates.sort((a, b) => b.blocks - a.blocks || a.path.length - b.path.length);
    const plan = candidates[0];
    if (!plan) throw Error('Nenhum ponto seguro para escavar');
    await walk(plan.path, `${label}-approach`);
    await read(`${label}-before-bomb`);
    await call('advance', { frames: 1, buttons: ['A'] }, `${label}-bomb`);
    await read(`${label}-birth`);
    await walk(plan.escape, `${label}-escape`);
    await call('advance', { frames: 220 }, `${label}-wait`);
    await read(`${label}-revealed`);
    return { blocks: plan.blocks, tile: plan.path.at(-1), items: current.items, inventory: current.inventory };
  }
  async function collect(glyph, label) {
    const reachable = paths();
    const item = current.items.find(item => item.glyph === glyph && reachable.has(key([item.x, item.y])));
    if (!item) return false;
    await read(`${label}-before`);
    await walk(reachable.get(key([item.x, item.y])), label);
    await read(`${label}-after`);
    return true;
  }
  return { call, read, dig, collect, paths, walk, get current() { return current; }, records,
    save: async name => fs.writeFile(`${output}/${name}.json`, JSON.stringify(records, null, 2), { flag: 'wx' }) };
}
