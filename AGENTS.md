# CodeGraph - LLM Integration Guide

This project uses **CodeGraph** — a local code graph memory system that provides persistent, structured understanding of the codebase across LLM sessions.

## What CodeGraph Does

CodeGraph scans source files, extracts symbols (classes, functions, methods, interfaces) and dependencies (imports, requires, extends, implements, calls), builds a weighted graph with PageRank importance scoring, and persists everything to `.codegraph/`.

This means you (the LLM) can quickly understand the codebase structure without reading every file.

## Commands

```bash
# First-time setup
npx tsx src/main.ts init

# Full scan (run once, or after major changes)
npx tsx src/main.ts scan

# Incremental update (fast, only re-scans changed files)
npx tsx src/main.ts update

# Check what changed since last scan
npx tsx src/main.ts status

# Export compact graph summary (token-efficient)
npx tsx src/main.ts export                        # default: LLM format, 4096 token budget
npx tsx src/main.ts export --tokens=8192          # larger budget
npx tsx src/main.ts export --format=json          # full graph as JSON
npx tsx src/main.ts export --format=dot           # GraphViz DOT for visualization

# Search for symbols
npx tsx src/main.ts query <symbol-name>

# Show dependencies for a file
npx tsx src/main.ts deps <file-path>

# Project summary
npx tsx src/main.ts summary

# List supported languages
npx tsx src/main.ts lang list

# Start MCP server (stdio transport)
npx tsx src/main.ts serve
```

## MCP Tools

When running as an MCP server, CodeGraph exposes these tools:

- **`codegraph_scan`** — Scan/update the code graph
- **`codegraph_query`** — Search symbols by name pattern
- **`codegraph_dependencies`** — Get deps and reverse-deps for a file
- **`codegraph_export`** — Export compact graph summary
- **`codegraph_status`** — Check scan status and file counts

## When to Use

1. **Start of session**: Run `codegraph export` to get a compact overview (~1-4K tokens)
2. **Need to find something**: Run `codegraph query <term>` instead of grepping
3. **Need to understand a file**: Run `codegraph deps <file>` to see relationships
4. **Files changed**: Run `codegraph update` to incrementally update the graph
5. **Major changes**: Run `codegraph scan` for a full re-scan

## Architecture

```
src/
├── main.ts              # Dual-mode entry (CLI vs MCP auto-detect)
├── cli.ts               # Commander CLI
├── mcp.ts               # MCP server
├── core/
│   ├── graph.ts         # graphology + PageRank
│   ├── scanner.ts       # File walker + parser orchestration
│   ├── git-tracker.ts   # Git blob-hash change detection
│   ├── config.ts        # Multi-repo config
│   └── store.ts         # SQLite persistence
├── parsers/             # Language-specific parsers (tree-sitter WASM)
├── exporters/           # LLM, JSON, DOT output formats
└── languages/           # Language registry and definitions
```

## Storage

- `.codegraph/config.json` — Repo registry + settings
- `.codegraph/codegraph.db` — SQLite database (symbols, edges, cache, snapshots)
- `.codegraph/graph.json` — (optional) exported graph snapshot

## Supported Languages

- **PHP** (built-in): classes, methods, functions, interfaces, traits, enums, constants
- **JavaScript** (built-in): classes, methods, functions, arrow functions
- **TypeScript** (built-in): classes, methods, functions, interfaces, enums, type aliases, properties
