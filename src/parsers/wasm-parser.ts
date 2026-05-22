import { Parser, Language, Query, QueryCapture } from 'web-tree-sitter';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageDefinition } from '../languages/registry.js';

const __thisFile = fileURLToPath(import.meta.url);

/**
 * Find the root directory that contains wasm/ and queries/ subdirectories.
 *
 * - Source/dev mode (bun run, tsx): the source file exists at its real path,
 *   so we navigate 2 dirs up (src/parsers/ → project root).
 * - Compiled binary mode (bun build --compile): import.meta.url is a virtual
 *   path baked in at compile time. We search standard locations relative to
 *   the binary's own executable path so the binary is self-sufficient once
 *   assets are installed alongside it.
 */
function findAssetRoot(): string {
  if (existsSync(__thisFile)) {
    // Source/dev: navigate up from src/parsers/wasm-parser.ts
    return resolve(dirname(__thisFile), '..', '..');
  }

  // Compiled binary: search candidate directories for the wasm/ subdir
  const binDir = dirname(process.execPath);
  const candidates = [
    binDir,                                              // assets next to binary
    resolve(binDir, '..', 'share', 'codegraph'),         // XDG system: /usr/local/share/codegraph
    join(process.env['HOME'] ?? '', '.local', 'share', 'codegraph'), // XDG user
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, 'wasm'))) return dir;
  }

  return binDir; // fallback — will produce a clear "file not found" on first use
}

const PROJECT_ROOT = findAssetRoot();

let parserInstance: Parser | null = null;
let initialized = false;

async function initParser(): Promise<Parser> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  if (!parserInstance) {
    parserInstance = new Parser();
  }
  return parserInstance;
}

export async function loadLanguage(langDef: LanguageDefinition): Promise<Language> {
  await initParser();
  const wasmPath = resolve(PROJECT_ROOT, langDef.grammarWasm);
  const wasmBuffer = await readFile(wasmPath);
  const language = await Language.load(wasmBuffer);
  return language;
}

export interface ParsedCaptures {
  symbols: Map<string, QueryCapture[]>;
  references: Map<string, QueryCapture[]>;
  nameByNodeId: Map<number, string>;
}

export async function parseWithQueries(
  source: string,
  language: Language,
  symbolsQuery: string,
  referencesQuery: string
): Promise<ParsedCaptures> {
  const parser = await initParser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  if (!tree) {
    return { symbols: new Map(), references: new Map(), nameByNodeId: new Map() };
  }

  const symbolCaptures = new Map<string, QueryCapture[]>();
  const refCaptures = new Map<string, QueryCapture[]>();
  const nameByNodeId = new Map<number, string>();

  try {
    const symQuery = new Query(language, symbolsQuery);
    const symMatches = symQuery.captures(tree.rootNode);
    const kindNodeIds = new Set<number>();
    for (const capture of symMatches) {
      const existing = symbolCaptures.get(capture.name) || [];
      existing.push(capture);
      symbolCaptures.set(capture.name, existing);

      if (capture.name.startsWith('symbol.kind_')) {
        kindNodeIds.add(capture.node.id);
      }
    }
    for (const capture of symMatches) {
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
  } catch (e: any) {
    if (!e.message?.includes('no query')) throw e;
  }

  try {
    const refQuery = new Query(language, referencesQuery);
    const refMatches = refQuery.captures(tree.rootNode);
    for (const capture of refMatches) {
      const existing = refCaptures.get(capture.name) || [];
      existing.push(capture);
      refCaptures.set(capture.name, existing);
    }
  } catch (e: any) {
    if (!e.message?.includes('no query')) throw e;
  }

  return { symbols: symbolCaptures, references: refCaptures, nameByNodeId };
}

export async function loadQueryFile(queryPath: string): Promise<string> {
  const fullPath = resolve(PROJECT_ROOT, queryPath);
  return readFile(fullPath, 'utf-8');
}

export { PROJECT_ROOT };
