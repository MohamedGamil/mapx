import type { SymbolKind } from '../types.js';

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  grammarWasm: string;
  queries: {
    symbols: string;
    references: string;
  };
  nodeMappings: Record<SymbolKind, string>;
  tier: 'built-in' | 'installable' | 'user';
}

const BUILTIN_LANGUAGES: Record<string, LanguageDefinition> = {
  php: {
    name: 'php',
    extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.php7'],
    grammarWasm: 'wasm/tree-sitter-php.wasm',
    queries: {
      symbols: 'queries/php/symbols.scm',
      references: 'queries/php/references.scm',
    },
    nodeMappings: {
      class: 'class_declaration',
      method: 'method_declaration',
      function: 'function_definition',
      interface: 'interface_declaration',
      trait: 'trait_declaration',
      constant: 'const_declaration',
      enum: 'enum_declaration',
      property: 'property_declaration',
      namespace: 'namespace_definition',
    },
    tier: 'built-in',
  },
  javascript: {
    name: 'javascript',
    extensions: ['.js', '.mjs', '.cjs'],
    grammarWasm: 'wasm/tree-sitter-javascript.wasm',
    queries: {
      symbols: 'queries/javascript/symbols.scm',
      references: 'queries/javascript/references.scm',
    },
    nodeMappings: {
      class: 'class_declaration',
      method: 'method_definition',
      function: 'function_declaration',
      interface: 'interface_declaration',
      constant: 'variable_declarator',
      enum: 'enum_declaration',
      property: 'property_identifier',
      namespace: 'internal_module',
      trait: '',
    },
    tier: 'built-in',
  },
  typescript: {
    name: 'typescript',
    extensions: ['.ts', '.cts', '.mts'],
    grammarWasm: 'wasm/tree-sitter-typescript.wasm',
    queries: {
      symbols: 'queries/typescript/symbols.scm',
      references: 'queries/typescript/references.scm',
    },
    nodeMappings: {
      class: 'class_declaration',
      method: 'method_definition',
      function: 'function_declaration',
      interface: 'interface_declaration',
      constant: 'variable_declarator',
      enum: 'enum_declaration',
      property: 'property_identifier',
      namespace: 'module',
      trait: '',
    },
    tier: 'built-in',
  },
};

export function getBuiltinLanguages(): Record<string, LanguageDefinition> {
  return { ...BUILTIN_LANGUAGES };
}

export function getLanguageForFile(
  filePath: string,
  userLanguages: Record<string, LanguageDefinition> = {}
): LanguageDefinition | null {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  for (const lang of Object.values({ ...BUILTIN_LANGUAGES, ...userLanguages })) {
    if (lang.extensions.includes(ext)) {
      return lang;
    }
  }

  return null;
}

export function getLanguageNames(): string[] {
  return Object.keys(BUILTIN_LANGUAGES);
}

export function isBuiltInLanguage(name: string): boolean {
  return name in BUILTIN_LANGUAGES;
}
