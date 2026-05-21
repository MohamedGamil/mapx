import { buildCLI } from './cli.js';

const args = process.argv.slice(2);
const isMcpMode = args[0] === 'serve' || (args.length === 0 && !process.stdin.isTTY);

if (isMcpMode && args[0] !== 'serve' && process.stdin.isTTY) {
  const program = buildCLI();
  program.parse(process.argv);
} else if (isMcpMode) {
  import('./mcp.js').then(mod => mod.startMcpServer()).catch(err => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
} else {
  const program = buildCLI();
  program.parse(process.argv);
}
