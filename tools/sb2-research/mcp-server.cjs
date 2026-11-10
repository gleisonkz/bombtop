// Ponte MCP de pesquisa com dependências já instaladas; sem configuração global.
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { createRequire } = require('module');
const localRequire = createRequire(path.join(process.env.SNES_MCP_HOME, 'package.json'));
const { McpServer } = localRequire('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = localRequire('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = localRequire('zod');
const worker = spawn(process.env.SNES_PYTHON || 'python', [path.join(__dirname, 'snes9x_worker.py'), process.env.SNES9X_CORE], { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] });
const pending = [];
readline.createInterface({ input: worker.stdout }).on('line', line => {
  const next = pending.shift();
  if (!next) return;
  try { const result = JSON.parse(line); result.error ? next.reject(Error(result.error)) : next.resolve(result.result); }
  catch (error) { next.reject(error); }
});
worker.on('exit', code => { while (pending.length) pending.shift().reject(Error(`Worker encerrou: ${code}`)); });
worker.on('error', error => { while (pending.length) pending.shift().reject(error); });
const server = new McpServer({ name: 'snes9x-research', version: '1.0.0' });
const tools = {
  load_rom: { path: z.string() },
  advance: { frames: z.number().int().min(1).max(36000), buttons: z.array(z.enum(['B','Y','SELECT','START','UP','DOWN','LEFT','RIGHT','A','X','L','R'])).optional(), buttons2: z.array(z.enum(['B','Y','SELECT','START','UP','DOWN','LEFT','RIGHT','A','X','L','R'])).optional(), screenshot: z.boolean().optional() },
  read_ram: { offset: z.number().int().min(0).optional(), length: z.number().int().positive().max(131072).optional() },
  save_state: { path: z.string() }, load_state: { path: z.string() }, status: {}, get_screen: {},
};
for (const [name, schema] of Object.entries(tools)) server.tool(name, `Snes9x: ${name}`, schema, async args => {
  try {
    const result = await new Promise((resolve, reject) => {
      if (worker.exitCode !== null || worker.killed) return reject(Error('Worker indisponível'));
      pending.push({ resolve, reject });
      worker.stdin.write(JSON.stringify({ name, arguments: args }) + '\n');
    });
    const { png, ...metadata } = result;
    return { content: [{ type: 'text', text: JSON.stringify(metadata) }, ...(png ? [{ type: 'image', mimeType: 'image/png', data: png }] : [])] };
  } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
});
process.stdin.on('end', () => { worker.stdin.end(); });
server.connect(new StdioServerTransport()).catch(error => { console.error(error); worker.kill(); process.exitCode = 1; });
