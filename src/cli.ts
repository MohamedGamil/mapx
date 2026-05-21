import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Store } from './core/store.js';
import { CodeGraph } from './core/graph.js';
import { Scanner } from './core/scanner.js';
import { Config } from './core/config.js';
import { LLMExporter } from './exporters/llm-exporter.js';
import { GraphExporter } from './exporters/graph-exporter.js';
import { DotExporter } from './exporters/dot-exporter.js';
import { getChangedFiles, isGitRepo } from './core/git-tracker.js';
import { getBuiltinLanguages } from './languages/registry.js';

const dynamicRequire = createRequire(import.meta.url);

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('codegraph')
    .description('Multi-language code graph memory system for LLMs')
    .version('0.1.0')
    .option('--cwd <path>', 'Working directory', process.cwd());

  program
    .command('init')
    .description('Initialize codegraph for the current project')
    .option('--name <name>', 'Repository name')
    .action(async (opts) => {
      const cwd = program.opts().cwd || process.cwd();
      const config = await Config.init(cwd, opts.name);
      console.log(`Initialized codegraph in ${cwd}/.codegraph/`);
      console.log(`Repo: ${config.repo.name}`);
    });

  program
    .command('scan')
    .description('Full scan: parse all files, build graph')
    .action(async () => {
      const cwd = program.opts().cwd || process.cwd();
      const { config, store, graph } = await loadContext(cwd);

      const scanner = new Scanner(store, config, graph);
      const result = await scanner.scanFull();

      console.log(`Scanned ${result.filesScanned} files in ${result.durationMs}ms`);
      console.log(`Languages: ${Object.entries(result.languageBreakdown).map(([l, c]) => `${l}: ${c}`).join(', ')}`);
      console.log(`Found ${result.symbolsFound} symbols, ${result.edgesFound} edges`);
    });

  program
    .command('update')
    .description('Incremental scan: re-scan only changed files')
    .action(async () => {
      const cwd = program.opts().cwd || process.cwd();
      const { config, store, graph } = await loadContext(cwd);

      const repoRoot = resolve(cwd, config.repo.path);
      if (!isGitRepo(repoRoot)) {
        console.log('Not a git repo, falling back to full scan');
        const scanner = new Scanner(store, config, graph);
        const result = await scanner.scanFull();
        console.log(`Scanned ${result.filesScanned} files, ${result.symbolsFound} symbols, ${result.edgesFound} edges in ${result.durationMs}ms`);
        return;
      }

      const changes = getChangedFiles(repoRoot);
      if (changes.length === 0) {
        console.log('No changes detected');
        return;
      }

      const scanner = new Scanner(store, config, graph);
      const result = await scanner.scanIncremental();

      console.log(`Updated ${result.filesScanned} files in ${result.durationMs}ms`);
      console.log(`${result.symbolsFound} symbols updated, ${result.edgesFound} edges updated`);
    });

  program
    .command('status')
    .description('Show changed files since last scan')
    .action(async () => {
      const cwd = program.opts().cwd || process.cwd();
      const { config, store } = await loadContext(cwd);

      const repoRoot = resolve(cwd, config.repo.path);
      if (!isGitRepo(repoRoot)) {
        console.log('Not a git repo');
        return;
      }

      const lastScan = store.getMeta('last_scan_time');
      const lastCommit = store.getMeta('last_scan_commit');
      console.log(`Last scan: ${lastScan || 'never'}`);
      console.log(`Last commit: ${lastCommit || 'none'}`);

      const changes = getChangedFiles(repoRoot, lastCommit || undefined);
      if (changes.length === 0) {
        console.log('No changes since last scan');
      } else {
        console.log(`\n${changes.length} changed files:`);
        for (const change of changes) {
          const icon = { added: '+', modified: '~', removed: '-', renamed: '>', unchanged: '=' }[change.status];
          console.log(`  ${icon} ${change.path}`);
        }
      }
    });

  program
    .command('query <term>')
    .description('Search for symbols by name')
    .action(async (term: string) => {
      const cwd = program.opts().cwd || process.cwd();
      const { store } = await loadContext(cwd);

      const results = store.searchSymbols(term);
      if (results.length === 0) {
        console.log(`No symbols matching "${term}"`);
        return;
      }

      for (const sym of results) {
        const scope = sym.scope ? `${sym.scope}::` : '';
        console.log(`  ${sym.kind} ${scope}${sym.name}`);
        console.log(`    @ ${sym.file_path}:${sym.start_line}`);
        if (sym.signature && sym.signature !== sym.name) {
          console.log(`    signature: ${sym.signature}`);
        }
      }
    });

  program
    .command('deps <file>')
    .description('Show dependencies for a file')
    .action(async (file: string) => {
      const cwd = program.opts().cwd || process.cwd();
      const { store, graph } = await loadContext(cwd);

      const deps = graph.getDependencies(file);
      const rdeps = graph.getReverseDependencies(file);

      if (deps.length > 0) {
        console.log('Dependencies:');
        for (const dep of deps) {
          console.log(`  → ${dep.target} (${dep.type})`);
        }
      } else {
        console.log('No dependencies found');
      }

      if (rdeps.length > 0) {
        console.log('\nDepended on by:');
        for (const rdep of rdeps) {
          console.log(`  ← ${rdep.source} (${rdep.type})`);
        }
      }
    });

  program
    .command('export')
    .description('Export code graph for LLM consumption')
    .option('--format <format>', 'Output format: llm, json, dot', 'llm')
    .option('--tokens <budget>', 'Token budget for LLM export', '4096')
    .option('--repo <name>', 'Filter by repo name')
    .action(async (opts) => {
      const cwd = program.opts().cwd || process.cwd();
      const { store, graph } = await loadContext(cwd);

      const format = opts.format as string;
      const tokenBudget = parseInt(opts.tokens as string, 10) || 4096;

      switch (format) {
        case 'json': {
          const exporter = new GraphExporter(store, graph);
          console.log(exporter.exportAsJSONString(opts.repo));
          break;
        }
        case 'dot': {
          const exporter = new DotExporter(store, graph);
          console.log(exporter.export(opts.repo));
          break;
        }
        case 'llm':
        default: {
          const exporter = new LLMExporter(store, graph);
          console.log(exporter.export({
            format: 'llm',
            tokenBudget,
            repo: opts.repo,
          }));
          break;
        }
      }
    });

  program
    .command('summary')
    .description('Show project summary')
    .action(async () => {
      const cwd = program.opts().cwd || process.cwd();
      const { store, graph, config } = await loadContext(cwd);

      const fileCount = store.getFileCount();
      const symbolCount = store.getSymbolCount();
      const edgeCount = store.getEdgeCount();
      const breakdown = store.getLanguageBreakdown();

      console.log(`Project: ${config.repo.name}`);
      console.log(`Files: ${fileCount}`);
      console.log(`Symbols: ${symbolCount}`);
      console.log(`Dependencies: ${edgeCount}`);
      console.log(`Languages: ${Object.entries(breakdown).map(([l, c]) => `${l} (${c})`).join(', ')}`);
    });

  program
    .command('lang')
    .description('Language support commands')
    .addCommand(
      new Command('list')
        .description('List available languages')
        .action(() => {
          const langs = getBuiltinLanguages();
          console.log('Built-in languages:');
          for (const [name, def] of Object.entries(langs)) {
            console.log(`  ${name}: ${def.extensions.join(', ')} [${def.tier}]`);
          }
        })
    );

  return program;
}

async function loadContext(cwd: string): Promise<{
  config: Config;
  store: Store;
  graph: CodeGraph;
}> {
  const configPath = resolve(cwd, '.codegraph', 'config.json');
  if (!existsSync(configPath)) {
    console.error('CodeGraph not initialized. Run `codegraph init` first.');
    process.exit(1);
  }

  const config = await Config.load(cwd);
  const dbPath = resolve(cwd, '.codegraph', 'codegraph.db');
  const store = new Store(dbPath);
  const graph = new CodeGraph(config.repo.name);

  const files = store.getAllFiles();
  for (const file of files) {
    graph.addFileNode(
      file.path as string,
      file.language as string,
      file.size_bytes as number,
      file.lines as number
    );
  }

  const symbols = store.getAllSymbols();
  for (const sym of symbols) {
    graph.addSymbolNode(
      sym.name as string,
      sym.file_path as string,
      sym.name as string,
      sym.kind as any,
      sym.start_line as number,
      sym.end_line as number,
      sym.scope as string | null
    );
  }

  const edges = store.getAllEdges();
  for (const edge of edges) {
    graph.addDependencyEdge({
      sourceFile: edge.source_file as string,
      targetFile: edge.target_file as string,
      sourceSymbol: edge.source_symbol as string | null,
      targetSymbol: edge.target_symbol as string | null,
      edgeType: edge.edge_type as any,
      repo: edge.repo as string,
      weight: edge.weight as number,
    });
  }

  return { config, store, graph };
}
