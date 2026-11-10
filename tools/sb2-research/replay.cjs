// Executa um plano de chamadas MCP e preserva imagens, RAM e metadados.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const dependencies = createRequire(path.join(process.env.SNES_MCP_HOME, 'package.json'));
const { Client } = dependencies('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = dependencies('@modelcontextprotocol/sdk/client/stdio.js');
(async () => {
  const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  const output = path.resolve(plan.output);
  fs.mkdirSync(output, { recursive: true });
  const journal = path.join(output, 'journal.json');
  if (fs.existsSync(journal)) throw Error('Use uma pasta nova para preservar o ensaio anterior');
  const client = new Client({ name: 'sb2-research-replay', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [path.join(__dirname, 'mcp-server.cjs')], env: process.env });
  const records = [];
  try {
    await client.connect(transport);
    for (const step of plan.steps) {
      const result = await client.callTool({ name: step.name, arguments: step.arguments || {} });
      const content = [];
      for (const block of result.content || []) {
        if (block.type === 'image') {
          if (!step.image) throw Error('Defina image para preservar a captura');
          const imagePath = path.resolve(output, step.image);
          if (path.dirname(imagePath) !== output) throw Error('Imagem deve ficar na pasta do ensaio');
          fs.writeFileSync(imagePath, Buffer.from(block.data, 'base64'), { flag: 'wx' });
          content.push({ type: 'image', path: imagePath });
        } else content.push(block);
      }
      records.push({ step, isError: !!result.isError, content });
      fs.writeFileSync(journal, JSON.stringify({ plan, records }, null, 2));
      if (result.isError) throw Error(JSON.stringify(content));
      console.log(step.name, step.image || 'ok');
    }
  } finally { await client.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
