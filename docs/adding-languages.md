# Adding Languages

MapxGraph supports three tiers of language support.

## Tier 1: Built-in Languages

PHP, JavaScript, and TypeScript are built-in and always available. Their tree-sitter WASM grammars and queries are bundled with the tool.

## Tier 2: Installable Languages

To add support for additional languages, you need:

1. A tree-sitter WASM grammar file (`.wasm`)
2. Symbol extraction queries (`.scm` file)
3. Reference extraction queries (`.scm` file, optional)

### Step-by-step: Adding Python

1. **Get the WASM grammar:**
   ```bash
   npm install tree-sitter-python
   cp node_modules/tree-sitter-python/tree-sitter-python.wasm wasm/
   ```

2. **Create query files:**

   Create `queries/python/symbols.scm`:
   ```scheme
   (function_definition
     name: (identifier) @symbol.name) @symbol.kind_function

   (class_definition
     name: (identifier) @symbol.name) @symbol.kind_class

   (decorated_definition
     definition: (function_definition
       name: (identifier) @symbol.name)) @symbol.kind_function
   ```

   Create `queries/python/references.scm`:
   ```scheme
   (import_statement
     name: (dotted_name) @ref.target_import) @ref.type_import

   (import_from_statement
     module_name: (dotted_name) @ref.target_import) @ref.type_import

   (class_definition
     superclasses: (argument_list
       (identifier) @ref.target_extends)) @ref.type_extends
   ```

3. **Register in `src/languages/registry.ts`:**
   ```typescript
   python: {
     name: 'python',
     extensions: ['.py', '.pyw'],
     grammarWasm: 'wasm/tree-sitter-python.wasm',
     queries: {
       symbols: 'queries/python/symbols.scm',
       references: 'queries/python/references.scm',
     },
     nodeMappings: {
       class: 'class_definition',
       method: 'function_definition',
       function: 'function_definition',
       // ...
     },
     tier: 'built-in',
   },
   ```

4. **Create a parser class** in `src/parsers/languages/python.ts` following the pattern in `php.ts`.

5. **Register in `src/parsers/parser-registry.ts`.**

## Tier 3: User-Defined Languages

Users can add languages via `.mapx/config.json` without modifying the tool:

```json
{
  "languages": {
    "zig": {
      "extensions": [".zig"],
      "grammarWasm": "./grammars/tree-sitter-zig.wasm",
      "queries": {
        "symbols": "./queries/zig/symbols.scm"
      },
      "nodeMappings": {
        "function": "function_declaration",
        "class": "struct_declaration"
      }
    }
  }
}
```

## Finding Node Types

To discover the correct node type names for a new language:

```bash
node -e "
import('web-tree-sitter').then(async m => {
  await m.Parser.init();
  const p = new m.Parser();
  const { readFileSync } = await import('fs');
  const wasm = readFileSync('wasm/tree-sitter-YOUR-LANG.wasm');
  const lang = await m.Language.load(wasm);
  p.setLanguage(lang);
  const code = 'your sample code here';
  const tree = p.parse(code);
  function walk(node, depth = 0) {
    if (depth > 5) return;
    console.log('  '.repeat(depth) + node.type);
    for (let i = 0; i < node.childCount; i++) walk(node.child(i), depth + 1);
  }
  walk(tree.rootNode);
});
"
```

This prints the full tree structure so you can identify the correct node types for your queries.
