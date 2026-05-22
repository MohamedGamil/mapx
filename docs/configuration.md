# Configuration

MapxGraph stores its configuration in `.mapx/config.json`.

## Default Config

```json
{
  "version": "1.0.0",
  "repos": [
    {
      "name": "my-project",
      "path": "."
    }
  ],
  "languages": {},
  "settings": {
    "maxTokenBudget": 16384,
    "excludePatterns": [
      "node_modules/**",
      "vendor/**",
      ".git/**",
      "dist/**",
      ".mapx/**",
      "*.min.js",
      "*.min.css",
      "package-lock.json",
      "composer.lock"
    ],
    "includePatterns": []
  }
}
```

## Multi-Repo Setup

To track multiple repos or monorepo components:

```json
{
  "repos": [
    { "name": "frontend", "path": "./apps/web" },
    { "name": "backend", "path": "./apps/api" },
    { "name": "shared", "path": "./packages/shared" }
  ]
}
```

## User-Defined Languages

Add custom language support without modifying the tool:

```json
{
  "languages": {
    "python": {
      "extensions": [".py"],
      "grammarWasm": "wasm/tree-sitter-python.wasm",
      "queries": {
        "symbols": "queries/python/symbols.scm",
        "references": "queries/python/references.scm"
      },
      "nodeMappings": {
        "class": "class_definition",
        "function": "function_definition",
        "method": "function_definition"
      }
    }
  }
}
```

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxTokenBudget` | number | 16384 | Maximum token budget for LLM export |
| `excludePatterns` | string[] | (see above) | Glob patterns for files to exclude |
| `includePatterns` | string[] | [] | If set, only include matching files |
