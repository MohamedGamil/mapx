import { resolve, relative, basename } from 'node:path';
import type { LanguageParser } from './parser-interface.js';
import type { LanguageDefinition } from '../languages/registry.js';
import type { ParseResult, ExtractedSymbol, ExtractedReference } from '../types.js';
import { getLanguageForFile } from '../languages/registry.js';

export class FallbackParser implements LanguageParser {
  readonly languageName = 'fallback';

  get supportedExtensions(): string[] {
    return [];
  }

  async parse(filePath: string, source: string): Promise<ParseResult> {
    const lines = source.split('\n');
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    return {
      symbols: [],
      references: [],
      errors: [],
    };
  }
}
