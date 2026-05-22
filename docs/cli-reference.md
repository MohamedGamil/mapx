# CLI Reference

## Target Directory

All commands accept a target directory. Three ways to specify:

```bash
# 1. Positional path argument
mapx scan /path/to/project

# 2. --dir / -d flag
mapx scan --dir /path/to/project
mapx query "MyClass" -d /path/to/project

# 3. Global flag (works with any subcommand)
mapx -d /path/to/project scan

# If no directory is specified, defaults to current working directory.
```

## `mapx init`

Initialize MapxGraph in the current project. Creates `.mapx/` directory and `AGENTS.md`.

```bash
mapx init [/path] [--name <repo-name>] [--no-agents]
```

Options:
- `[path]` — Target directory (positional)
- `--name` — Custom repository name (defaults to directory name)
- `--no-agents` — Skip AGENTS.md creation

## `mapx scan`

Perform a full scan of all source files. Builds the graph from scratch.

- Shows real-time progress: discover, index, and parse phases
- File reads are parallelized for faster scanning
- Survives interruptions: progress is saved per-file, re-run to resume

```bash
mapx scan [/path]
```

## `mapx update`

Incremental scan. Detects changed files via git and only re-scans those.

```bash
mapx update [/path]
```

## `mapx status`

Show scan metrics, collected data, graph statistics, and git changes since the last scan.

```bash
mapx status [/path]
```

Outputs:
- **Scan info**: project name, directory, last scan time, last git commit, schema version
- **Collected data**: file/symbol/edge counts, language breakdown, symbol kind breakdown, edge type breakdown
- **Graph metrics**: graph density, average edges per file, top 5 most-connected files
- **Storage**: database path and size
- **Git changes**: added/modified/removed/renamed files since last scan

## `mapx query <term>`

Search for symbols by name pattern (supports partial matching).

```bash
mapx query <term> [--dir /path]
```

Examples:
```bash
mapx query User
mapx query handleSave
```

## `mapx deps <file>`

Show dependencies (what the file depends on) and reverse dependencies (what depends on it).

```bash
mapx deps <file> [--dir /path]
```

## `mapx export`

Export the code graph in various formats.

```bash
mapx export [--format <fmt>] [--tokens <budget>] [--repo <name>] [-o <file>]
```

Options:
- `--format` — Output format: `llm` (default), `json`, `dot`, `svg`
- `--tokens` — Token budget for LLM format (default: 8192)
- `--repo` — Filter by repository name
- `-o, --output <file>` — Write output to file instead of stdout. Validates path before export.

Examples:
```bash
mapx export                                          # Compact LLM summary (stdout)
mapx export -o summary.txt                           # LLM summary to file
mapx export --format=json -o graph.json              # Full JSON graph to file
mapx export --format=dot -o graph.dot                # GraphViz DOT to file
mapx export --format=svg -o graph.svg                # SVG visualization to file
mapx export --format=svg                             # SVG to stdout
mapx export --tokens=16384                           # More detailed LLM summary
```

### Output File Validation

When using `-o, --output`, the tool validates the path before running the export:
- Checks that the parent directory exists
- Verifies write permission with a probe write
- Exits with error if the path is invalid

### SVG Export

The `--format=svg` option generates an SVG visualization of the code graph:

- **With GraphViz installed**: Uses `dot -Tsvg` for high-quality layout and rendering
- **Without GraphViz**: Uses the built-in fallback renderer with PageRank-weighted nodes, language colors, and styled edges

See [Installing GraphViz](#installing-graphviz) for setup instructions.

## `mapx summary`

Show a one-line project summary (file count, symbol count, languages).

```bash
mapx summary [/path]
```

## `mapx lang list`

List supported languages.

```bash
mapx lang list
```

## `mapx serve`

Start as an MCP server. Supports stdio (default) and SSE (HTTP) transports.

```bash
mapx serve [--dir /path] [--sse] [--port <port>]
```

Options:
- `--dir / -d` — Default target directory for MCP tools
- `--sse` — Enable SSE (HTTP) transport instead of stdio
- `--port <port>` — Port for SSE transport (default: 45123)

On startup, prints ready-to-copy configuration snippets for Claude Desktop, Cursor, and VS Code. SSE mode additionally prints the connection URL and messages endpoint.

> **Note:** When started without `--dir`, the server checks whether the current working directory is an initialized MapxGraph project. If it is, that directory becomes the default. Otherwise no default is set and each tool call must include a `dir` argument. The active directory is logged to stderr at startup.

Examples:
```bash
mapx serve --dir /path/to/project                  # stdio (default)
mapx serve --sse --port 3456 --dir /path/to/project  # SSE on port 3456
```

See [MCP Integration](mcp-integration.md) for full client configuration details.

## Installing GraphViz

For high-quality SVG exports, install GraphViz. The SVG exporter uses `dot -Tsvg` when available and falls back to a built-in renderer otherwise.

### Linux

```bash
# Debian/Ubuntu
sudo apt-get install graphviz

# Fedora/RHEL
sudo dnf install graphviz

# Alpine
apk add graphviz

# Arch
sudo pacman -S graphviz
```

### macOS

```bash
# Homebrew
brew install graphviz

# MacPorts
sudo port install graphviz
```

### Windows

```bash
# winget
winget install graphviz

# Chocolatey
choco install graphviz

# Scoop
scoop install graphviz
```

### Conda (any platform)

```bash
conda install -c conda-forge graphviz
```

### Verify Installation

```bash
dot -V
# Expected output: dot - graphviz version X.X.X
```
