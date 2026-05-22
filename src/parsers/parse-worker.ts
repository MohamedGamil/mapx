import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

interface ParseJob {
  id: number;
  filePath: string;
  absolutePath: string;
}

interface ParseResult {
  id: number;
  symbols: Array<{
    name: string;
    kind: string;
    scope: string | null;
    signature: string;
    startLine: number;
    endLine: number;
    metadata: Record<string, unknown>;
  }>;
  references: Array<{
    sourceSymbol: string | null;
    targetName: string;
    referenceType: string;
    startLine: number;
  }>;
  errors: Array<{ message: string; line?: number }>;
}

let parserReady = false;
let Parser: any;
let Language: any;
let Query: any;
let loadedLanguages: Map<string, { language: any; symbolsQuery: string; referencesQuery: string }> = new Map();
let langDefs: Map<string, any>;

async function initParser(): Promise<void> {
  if (parserReady) return;
  const mod = await import('web-tree-sitter');
  Parser = mod.Parser;
  Language = mod.Language;
  Query = mod.Query;
  await Parser.init();
  parserReady = true;
}

async function parseFile(job: ParseJob): Promise<ParseResult> {
  const empty: ParseResult = { id: job.id, symbols: [], references: [], errors: [] };

  let source: string;
  try {
    source = await readFile(job.absolutePath, 'utf-8');
  } catch {
    return { ...empty, errors: [{ message: `Failed to read ${job.filePath}` }] };
  }

  const ext = job.filePath.substring(job.filePath.lastIndexOf('.'));
  let langKey = '';
  for (const [key, def] of langDefs) {
    if (def.extensions.includes(ext)) {
      langKey = key;
      break;
    }
  }
  if (!langKey) return empty;

  let langCtx = loadedLanguages.get(langKey);
  if (!langCtx) {
    try {
      const def = langDefs.get(langKey);
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const wasmPath = resolve(__dirname, '..', '..', def.grammarWasm);
      const wasmBuffer = await readFile(wasmPath);
      const language = await Language.load(wasmBuffer);

      const queriesBase = resolve(__dirname, '..', '..');
      const symbolsQuery = await readFile(resolve(queriesBase, def.queries.symbols), 'utf-8');
      const referencesQuery = await readFile(resolve(queriesBase, def.queries.references), 'utf-8');

      langCtx = { language, symbolsQuery, referencesQuery };
      loadedLanguages.set(langKey, langCtx);
    } catch {
      return { ...empty, errors: [{ message: `Failed to load language for ${job.filePath}` }] };
    }
  }

  try {
    const parser = new Parser();
    parser.setLanguage(langCtx.language);
    const tree = parser.parse(source);

    const symbols: ParseResult['symbols'] = [];
    const references: ParseResult['references'] = [];

    try {
      const symQuery = new Query(langCtx.language, langCtx.symbolsQuery);
      for (const capture of symQuery.captures(tree.rootNode)) {
        const nodeText = capture.node.text;
        const startLine = capture.node.startPosition.row + 1;
        const endLine = capture.node.endPosition.row + 1;

        if (capture.name.startsWith('symbol.')) {
          const kind = capture.name.split('.').pop() || 'function';
          symbols.push({
            name: nodeText,
            kind,
            scope: null,
            signature: nodeText,
            startLine,
            endLine,
            metadata: {},
          });
        }
      }
    } catch {}

    try {
      const refQuery = new Query(langCtx.language, langCtx.referencesQuery);
      for (const capture of refQuery.captures(tree.rootNode)) {
        const nodeText = capture.node.text;
        const startLine = capture.node.startPosition.row + 1;

        if (capture.name.startsWith('ref.')) {
          const refType = capture.name.split('.').pop() || 'call';
          references.push({
            sourceSymbol: null,
            targetName: nodeText,
            referenceType: refType,
            startLine,
          });
        }
      }
    } catch {}

    return { id: job.id, symbols, references, errors: [] };
  } catch {
    return { ...empty, errors: [{ message: `Failed to parse ${job.filePath}` }] };
  }
}

async function main() {
  langDefs = new Map(Object.entries(workerData.languages));

  await initParser();

  parentPort!.on('message', async (job: ParseJob) => {
    const result = await parseFile(job);
    parentPort!.postMessage(result);
  });

  parentPort!.postMessage({ type: 'ready' });
}

main().catch((err) => {
  parentPort!.postMessage({ type: 'error', error: err.message });
});
