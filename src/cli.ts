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
import type { ScanProgress, ProgressCallback } from './types.js';

const dynamicRequire = createRequire(import.meta.url);

function resolveDir(cmdOpts: Record<string, unknown>, programOpts: Record<string, unknown>): string {
  const raw = (cmdOpts.dir as string) || (programOpts.dir as string) || process.cwd();
  return resolve(raw);
}

const PHASE_LABELS: Record<ScanProgress['phase'], { active: string; done: string }> = {
  discover: { active: 'Discovering files', done: 'Discovered files' },
  index: { active: 'Indexing files', done: 'Indexed files' },
  parse: { active: 'Parsing files', done: 'Parsed files' },
  resolve: { active: 'Resolving references', done: 'Resolved references' },
  detect: { active: 'Detecting changes', done: 'Detected changes' },
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⸦', '⢼', '⣴', '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽', '⣾'];
let spinnerIdx = 0;

function createProgressRenderer(): ProgressCallback {
  let lastPhase: ScanProgress['phase'] | null = null;
  let lastLineLen = 0;

  const writeLine = (line: string) => {
    const clear = lastLineLen > 0 ? '\r' + ' '.repeat(lastLineLen) + '\r' : '\r';
    process.stderr.write(clear + line);
    lastLineLen = line.length;
  };

  const renderBar = (current: number, total: number, width: number = 20): string => {
    if (total === 0) {
      const frame = SPINNER_FRAMES[spinnerIdx++ % SPINNER_FRAMES.length];
      return `${frame} `;
    }
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const pct = Math.round((current / total) * 100);
    return `${bar} ${pct}%`;
  };

  return (progress: ScanProgress) => {
    const { phase, current, total, file } = progress;
    const label = PHASE_LABELS[phase];
    const isNewPhase = phase !== lastPhase;

    if (isNewPhase && lastPhase !== null) {
      const prevLabel = PHASE_LABELS[lastPhase];
      writeLine(`  ✔ ${prevLabel.done}\n`);
    }

    lastPhase = phase;

    const bar = renderBar(current, total);
    const counter = total > 0 ? `${current}/${total}` : `${current}`;
    let line = `  ${label.active} ${bar} ${counter}`;

    if (file) {
      const maxFileLen = Math.max(0, 60 - line.length);
      const displayFile = file.length > maxFileLen && maxFileLen > 3
        ? '…' + file.slice(-(maxFileLen - 1))
        : file.length <= maxFileLen ? file : '';
      if (displayFile) {
        line += ` ${displayFile}`;
      }
    }

    writeLine(line);
  };
}

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('codegraph')
    .description('Multi-language code graph memory system for LLMs')
    .version('0.1.0')
    .option('-d, --dir <path>', 'Target project directory (default: current directory)');

  program
    .command('init')
    .description('Initialize codegraph for a project')
    .argument('[path]', 'Target directory')
    .option('--name <name>', 'Repository name')
    .action(async (path: string | undefined, opts: Record<string, unknown>) => {
      const dir = path ? resolve(path) : resolveDir(opts, program.opts());
      const config = await Config.init(dir, opts.name as string | undefined);
      console.log(`Initialized codegraph in ${dir}/.codegraph/`);
      console.log(`Repo: ${config.repo.name}`);
    });

  program
    .command('scan')
    .description('Full scan: parse all files, build graph')
    .argument('[path]', 'Target directory')
    .action(async (path: string | undefined) => {
      const dir = path ? resolve(path) : resolveDir({}, program.opts());
      const { config, store, graph } = await loadContext(dir);

      const onProgress = createProgressRenderer();
      const scanner = new Scanner(store, config, graph, onProgress);
      const result = await scanner.scanFull();

      process.stderr.write('\r' + ' '.repeat(80) + '\r');
      console.log(`Scanned ${result.filesScanned} files in ${result.durationMs}ms`);
      console.log(`Languages: ${Object.entries(result.languageBreakdown).map(([l, c]) => `${l}: ${c}`).join(', ')}`);
      console.log(`Found ${result.symbolsFound} symbols, ${result.edgesFound} edges`);
    });

  program
    .command('update')
    .description('Incremental scan: re-scan only changed files')
    .argument('[path]', 'Target directory')
    .action(async (path: string | undefined) => {
      const dir = path ? resolve(path) : resolveDir({}, program.opts());
      const { config, store, graph } = await loadContext(dir);
      const onProgress = createProgressRenderer();

      const repoRoot = resolve(dir, config.repo.path);
      if (!isGitRepo(repoRoot)) {
        console.log('Not a git repo, falling back to full scan');
        const scanner = new Scanner(store, config, graph, onProgress);
        const result = await scanner.scanFull();
        process.stderr.write('\r' + ' '.repeat(80) + '\r');
        console.log(`Scanned ${result.filesScanned} files, ${result.symbolsFound} symbols, ${result.edgesFound} edges in ${result.durationMs}ms`);
        return;
      }

      const changes = getChangedFiles(repoRoot);
      if (changes.length === 0) {
        console.log('No changes detected');
        return;
      }

      const scanner = new Scanner(store, config, graph, onProgress);
      const result = await scanner.scanIncremental();

      process.stderr.write('\r' + ' '.repeat(80) + '\r');
      console.log(`Updated ${result.filesScanned} files in ${result.durationMs}ms`);
      console.log(`${result.symbolsFound} symbols updated, ${result.edgesFound} edges updated`);
    });

  program
    .command('status')
    .description('Show changed files since last scan')
    .argument('[path]', 'Target directory')
    .action(async (path: string | undefined) => {
      const dir = path ? resolve(path) : resolveDir({}, program.opts());
      const { config, store } = await loadContext(dir);

      const repoRoot = resolve(dir, config.repo.path);
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
    .option('-d, --dir <path>', 'Target directory')
    .action(async (term: string, opts: Record<string, unknown>) => {
      const dir = resolveDir(opts, program.opts());
      const { store } = await loadContext(dir);

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
    .option('-d, --dir <path>', 'Target directory')
    .action(async (file: string, opts: Record<string, unknown>) => {
      const dir = resolveDir(opts, program.opts());
      const { store, graph } = await loadContext(dir);

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
    .option('-d, --dir <path>', 'Target directory')
    .option('--format <format>', 'Output format: llm, json, dot', 'llm')
    .option('--tokens <budget>', 'Token budget for LLM export', '8192')
    .option('--repo <name>', 'Filter by repo name')
    .action(async (opts: Record<string, unknown>) => {
      const dir = resolveDir(opts, program.opts());
      const { store, graph } = await loadContext(dir);

      const format = opts.format as string;
      const tokenBudget = parseInt(opts.tokens as string, 10) || 8192;

      switch (format) {
        case 'json': {
          const exporter = new GraphExporter(store, graph);
          console.log(exporter.exportAsJSONString(opts.repo as string | undefined));
          break;
        }
        case 'dot': {
          const exporter = new DotExporter(store, graph);
          console.log(exporter.export(opts.repo as string | undefined));
          break;
        }
        case 'llm':
        default: {
          const exporter = new LLMExporter(store, graph);
          console.log(exporter.export({
            format: 'llm',
            tokenBudget,
            repo: opts.repo as string | undefined,
          }));
          break;
        }
      }
    });

  program
    .command('summary')
    .description('Show project summary')
    .argument('[path]', 'Target directory')
    .action(async (path: string | undefined) => {
      const dir = path ? resolve(path) : resolveDir({}, program.opts());
      const { store, graph, config } = await loadContext(dir);

      const fileCount = store.getFileCount();
      const symbolCount = store.getSymbolCount();
      const edgeCount = store.getEdgeCount();
      const breakdown = store.getLanguageBreakdown();

      console.log(`Project: ${config.repo.name} (${dir})`);
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

  program
    .command('serve')
    .description('Start MCP server (stdio transport)')
    .option('-d, --dir <path>', 'Default target directory for MCP tools')
    .action(async (opts: Record<string, unknown>) => {
      const defaultDir = resolveDir(opts, program.opts());
      const { startMcpServer } = await import('./mcp.js');
      await startMcpServer(defaultDir);
    });

  return program;
}

export async function loadContext(dir: string): Promise<{
  config: Config;
  store: Store;
  graph: CodeGraph;
}> {
  const configPath = resolve(dir, '.codegraph', 'config.json');
  if (!existsSync(configPath)) {
    console.error(`CodeGraph not initialized in ${dir}. Run \`codegraph init ${dir}\` first.`);
    process.exit(1);
  }

  const config = await Config.load(dir);
  const dbPath = resolve(dir, '.codegraph', 'codegraph.db');
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
