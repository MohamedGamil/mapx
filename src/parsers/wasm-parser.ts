import { Parser, Language, Query, QueryCapture } from 'web-tree-sitter';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageDefinition } from '../languages/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

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

export async function parseWithQueries(
  source: string,
  language: Language,
  symbolsQuery: string,
  referencesQuery: string
): Promise<{ symbols: Map<string, QueryCapture[]>; references: Map<string, QueryCapture[]> }> {
  const parser = await initParser();
  parser.setLanguage(language);
  const tree = parser.parse(source);

  const symbolCaptures = new Map<string, QueryCapture[]>();
  const refCaptures = new Map<string, QueryCapture[]>();

  try {
    const symQuery = new Query(language, symbolsQuery);
    const symMatches = symQuery.captures(tree.rootNode);
    for (const capture of symMatches) {
      const existing = symbolCaptures.get(capture.name) || [];
      existing.push(capture);
      symbolCaptures.set(capture.name, existing);
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

  return { symbols: symbolCaptures, references: refCaptures };
}

export async function loadQueryFile(queryPath: string): Promise<string> {
  const fullPath = resolve(PROJECT_ROOT, queryPath);
  return readFile(fullPath, 'utf-8');
}

export { PROJECT_ROOT };
