import type { LanguageParser } from './parser-interface.js';
import type { LanguageDefinition } from '../languages/registry.js';
import { getLanguageForFile, getBuiltinLanguages } from '../languages/registry.js';
import { PhpParser } from './languages/php.js';
import { JavaScriptParser } from './languages/javascript.js';
import { TypeScriptParser } from './languages/typescript.js';
import { FallbackParser } from './fallback-parser.js';

const parserCache = new Map<string, LanguageParser>();
const fallbackParser = new FallbackParser();

export function getParserForFile(filePath: string, userLanguages?: Record<string, LanguageDefinition>): LanguageParser {
  const langDef = getLanguageForFile(filePath, userLanguages);
  if (!langDef) return fallbackParser;

  const cached = parserCache.get(langDef.name);
  if (cached) return cached;

  const parser = createParser(langDef);
  parserCache.set(langDef.name, parser);
  return parser;
}

function createParser(langDef: LanguageDefinition): LanguageParser {
  switch (langDef.name) {
    case 'php':
      return new PhpParser(langDef);
    case 'javascript':
      return new JavaScriptParser(langDef);
    case 'typescript':
      return new TypeScriptParser(langDef);
    default:
      return fallbackParser;
  }
}

export function clearParserCache(): void {
  parserCache.clear();
}
