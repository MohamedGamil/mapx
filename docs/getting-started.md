# Getting Started with CodeGraph

## Installation

```bash
# From source (development)
git clone <repo-url>
cd mem-project
npm install

# Or use pre-built binary (no dependencies needed)
# Download from releases/ and add to PATH
```

## Quick Start

```bash
# 1. Initialize CodeGraph in your project
cd /path/to/your/project
npx tsx /path/to/mem-project/src/main.ts init

# 2. Scan the codebase
npx tsx /path/to/mem-project/src/main.ts scan

# 3. View the graph summary
npx tsx /path/to/mem-project/src/main.ts export

# 4. Search for a symbol
npx tsx /path/to/mem-project/src/main.ts query MyClass

# 5. Check dependencies
npx tsx /path/to/mem-project/src/main.ts deps src/index.ts
```

## What Gets Created

Running `init` creates a `.codegraph/` directory in your project:

```
.codegraph/
├── config.json       # Project configuration
└── codegraph.db      # SQLite database (after scan)
```

Add `.codegraph/` to your `.gitignore` — it's a local development artifact.

## Supported File Types

| Language | Extensions | Symbols Extracted |
|----------|-----------|-------------------|
| PHP | `.php`, `.phtml` | classes, methods, functions, interfaces, traits, enums, constants |
| JavaScript | `.js`, `.mjs`, `.cjs` | classes, methods, functions, arrow functions |
| TypeScript | `.ts`, `.cts`, `.mts` | classes, methods, functions, interfaces, enums, properties |

## Dependencies Tracked

- `require` / `include` (PHP)
- `import` / `from` (JS/TS)
- `extends` / `implements` (all)
- Class instantiation (`new`)
- Function/method calls

## Building a Standalone Binary

```bash
# Build for current platform
bun build --compile --minify --bytecode ./src/main.ts --outfile codegraph

# Cross-compile for all platforms
npm run build:all
```

Binaries are output to `dist/` (~85-100MB each).
