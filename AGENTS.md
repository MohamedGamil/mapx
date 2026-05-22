<!-- mapx v0.1.6 -->
# MapxGraph - LLM Integration Guide

This project uses **MapxGraph** — a local code graph memory system that provides persistent, structured understanding of the codebase across LLM sessions.

## What MapxGraph Does

MapxGraph scans source files, extracts symbols (classes, functions, methods, interfaces) and dependencies (imports, requires, extends, implements, calls), builds a weighted graph with PageRank importance scoring, and persists everything to `.mapx/`.

This means you (the LLM) can quickly understand the codebase structure without reading every file.

## Commands

All commands accept a target directory. Three ways to specify:

```bash
# 1. Positional path argument
mapx scan /path/to/project

# 2. --dir / -d flag
mapx scan --dir /path/to/project
mapx query "MyClass" -d /path/to/project

# 3. Global flag (works with any subcommand)
mapx -d /path/to/project scan
```

### Available Commands

- `mapx init [path]` - First-time setup
- `mapx scan [path]` - Full scan
- `mapx update [path]` (alias: `sync`) - Incremental update (fast)
- `mapx status [path]` - Check what changed since last scan
- `mapx export [--dir path]` - Export compact graph summary
- `mapx query <symbol> [--dir path]` - Search for symbols
- `mapx deps <file> [--dir path]` - Show dependencies for a file
- `mapx summary [path]` - Project summary
- `mapx clusters [--dir path]` - List detected clusters/modules
- `mapx trace <symbol> [--dir path]` - Trace data flow
- `mapx serve --dir /path` - Start stdio MCP server
- `mapx workspaces` - Manage workspaces (multi-repository support)

## MCP Tools

When running as an MCP server, MapxGraph exposes these tools:
- `mapx_scan` - Scan the code graph (full scan)
- `mapx_sync` - Sync changed files to update the graph (incremental scan)
- `mapx_query` - Search symbols by name pattern
- `mapx_dependencies` - Get deps and reverse-deps for a file
- `mapx_export` - Export compact graph summary
- `mapx_status` - Check scan status and file counts
- `mapx_clusters` - List code clusters/modules
- `mapx_trace` - Trace data flow paths from a starting symbol or file
- `mapx_sources` - Find entry points (sources) in the codebase
- `mapx_sinks` - Find terminal consumers (sinks) in the codebase
- `mapx_workspaces` - Retrieve workspace configuration and repositories

## When to Use

1. **Start of session**: Run `mapx export` to get a compact overview.
2. **Need to find something**: Run `mapx query <term>` instead of grepping.
3. **Need to understand a file**: Run `mapx deps <file>` to see relationships.
4. **Files changed**: Run `mapx sync` (or `mapx update`) to incrementally update the graph.
5. **Major changes**: Run `mapx scan` for a full re-scan.
6. **Need a visual overview**: Run `mapx export --format=svg -o graph.svg`.
7. **Trace data flow**: Run `mapx trace <symbol>` to see where data comes from/goes.
<!-- /mapx -->