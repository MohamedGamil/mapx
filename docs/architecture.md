# Architecture

## Overview

CodeGraph is a local code graph memory system that provides persistent, structured understanding of codebases for LLMs.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  CLI / MCP   │────▶│   Scanner    │────▶│   Parsers    │
│  Interface   │     │  (Walker)    │     │ (tree-sitter)│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       │              ┌─────▼──────┐       ┌──────▼──────┐
       │              │ GitTracker │       │  Registry   │
       │              │ (changes)  │       │ (languages) │
       │              └─────┬──────┘       └─────────────┘
       │                    │
┌──────▼────────────────────▼──────┐
│              Store               │
│         (SQLite + Graph)         │
│  ┌─────────┐  ┌───────────────┐  │
│  │ SQLite  │  │  graphology   │  │
│  │ (disk)  │  │  (in-memory)  │  │
│  └─────────┘  └───────────────┘  │
└──────────────┬───────────────────┘
               │
        ┌──────▼──────┐
        │  Exporters   │
        │ LLM/JSON/DOT│
        └─────────────┘
```

## Core Components

### Scanner (`src/core/scanner.ts`)

Walks the filesystem, detects languages, orchestrates parsing, and stores results.

- **Full scan**: Walks all files, parses each with the appropriate language parser
- **Incremental scan**: Uses git blob-hash comparison to detect changed files, only re-parses those
- **Excludes**: `node_modules/`, `vendor/`, `.git/`, `dist/`, `.codegraph/`, and configurable patterns

### Graph (`src/core/graph.ts`)

Uses `graphology` directed multigraph with PageRank centrality.

- **Nodes**: Files and symbols (classes, methods, functions, etc.)
- **Edges**: Dependencies (import, require, extends, implements, call, instantiation)
- **PageRank**: Computed on-demand to rank files/symbols by structural importance
- **Serialization**: Can export/import the full graph as JSON

### Git Tracker (`src/core/git-tracker.ts`)

Uses git commands for change detection:

- `git ls-tree -r HEAD` — Get blob hashes for all tracked files
- `git diff --name-status` — Detect added/modified/removed files
- `git rev-parse HEAD` — Get current commit SHA

### Store (`src/core/store.ts`)

SQLite abstraction with two backends:

- **Node.js**: Uses `better-sqlite3` (native C++ addon)
- **Bun**: Uses `bun:sqlite` (built-in)

Tables: `files`, `symbols`, `edges`, `snapshots`, `meta`

### Parsers (`src/parsers/`)

Language-specific parsers built on `web-tree-sitter` (WASM):

- Each parser uses tree-sitter queries (`.scm` files) to extract symbols and references
- Parsers are lazy-loaded (grammar WASM loaded on first use)
- Language detection by file extension via the registry

### Exporters (`src/exporters/`)

- **LLM Exporter**: Compact ranked summary (Aider's Repo Map pattern)
  - PageRank-ranked files and symbols
  - Token-budgeted output with binary search truncation
  - Only shows signatures, not implementation bodies
- **Graph Exporter**: Full JSON with all data
- **DOT Exporter**: GraphViz DOT format for visualization

## Data Flow

1. `scan` → Scanner walks files → Parser extracts symbols/refs → Store persists to SQLite → Graph builds in-memory
2. `export` → Store loads data → Graph computes PageRank → Exporter renders output
3. `update` → GitTracker detects changes → Scanner re-parses changed files → Store updates
4. `query` → Store searches SQLite → Returns matching symbols with locations
5. `deps` → Graph traverses edges → Returns dependency tree
