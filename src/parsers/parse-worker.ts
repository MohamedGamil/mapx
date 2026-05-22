import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF_TYPE_MAP: Record<string, string> = {
  import: 'import',
  require: 'require',
  extends: 'extends',
  implements: 'implements',
  call: 'call',
  instantiation: 'instantiation',
};

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
let assetRoot: string;
let nameByNodeId: Map<number, string>;

function findAssetRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  if (existsSync(thisFile)) {
    return resolve(dirname(thisFile), '..', '..');
  }
  const binDir = dirname(process.execPath);
  const candidates = [
    binDir,
    resolve(binDir, '..', 'share', 'codegraph'),
    join(process.env['HOME'] ?? '', '.local', 'share', 'codegraph'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'wasm'))) return dir;
  }
  return binDir;
}

async function initParser(): Promise<void> {
  if (parserReady) return;
  assetRoot = findAssetRoot();
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
      const wasmPath = resolve(assetRoot, def.grammarWasm);
      const wasmBuffer = await readFile(wasmPath);
      const language = await Language.load(wasmBuffer);

      const symbolsQuery = await readFile(resolve(assetRoot, def.queries.symbols), 'utf-8');
      const referencesQuery = await readFile(resolve(assetRoot, def.queries.references), 'utf-8');

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
    if (!tree) {
      return { ...empty, errors: [{ message: `Parser returned null for ${job.filePath}` }] };
    }

    const symbols: ParseResult['symbols'] = [];
    const references: ParseResult['references'] = [];
    nameByNodeId = new Map();

    try {
      const symQuery = new Query(langCtx.language, langCtx.symbolsQuery);
      const allSymCaptures = symQuery.captures(tree.rootNode);
      const kindNodeIds = new Set<number>();
      for (const capture of allSymCaptures) {
        if (capture.name.startsWith('symbol.kind_')) {
          kindNodeIds.add(capture.node.id);
        }
      }
      for (const capture of allSymCaptures) {
        if (capture.name === 'symbol.name') {
          let node: any = capture.node.parent;
          while (node) {
            if (kindNodeIds.has(node.id)) {
              nameByNodeId.set(node.id, capture.node.text);
              break;
            }
            node = node.parent;
          }
        }
      }
      for (const capture of allSymCaptures) {
        if (capture.name.startsWith('symbol.kind_')) {
          const kind = capture.name.replace('symbol.kind_', '');
          const name = nameByNodeId.get(capture.node.id) || capture.node.text;
          symbols.push({
            name,
            kind,
            scope: null,
            signature: name,
            startLine: capture.node.startPosition.row + 1,
            endLine: capture.node.endPosition.row + 1,
            metadata: {},
          });
        }
      }
    } catch {}

    try {
      const refQuery = new Query(langCtx.language, langCtx.referencesQuery);
      for (const capture of refQuery.captures(tree.rootNode)) {
        const startLine = capture.node.startPosition.row + 1;

        if (capture.name.startsWith('ref.target_')) {
          const rawType = capture.name.replace('ref.target_', '');
          const refType = REF_TYPE_MAP[rawType] || 'call';
          let targetName = capture.node.text;
          if (rawType === 'import') {
            targetName = targetName.replace(/^['"]|['"]$/g, '');
          }
          references.push({
            sourceSymbol: null,
            targetName,
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
