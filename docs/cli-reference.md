# CLI Reference

## `codegraph init`

Initialize CodeGraph in the current project.

```bash
codegraph init [--name <repo-name>]
```

Options:
- `--name` — Custom repository name (defaults to directory name)

## `codegraph scan`

Perform a full scan of all source files. Builds the graph from scratch.

```bash
codegraph scan
```

## `codegraph update`

Incremental scan. Detects changed files via git and only re-scans those.

```bash
codegraph update
```

## `codegraph status`

Show files changed since the last scan.

```bash
codegraph status
```

## `codegraph query <term>`

Search for symbols by name pattern (supports partial matching).

```bash
codegraph query User
codegraph query handleSave
```

## `codegraph deps <file>`

Show dependencies (what the file depends on) and reverse dependencies (what depends on it).

```bash
codegraph deps src/index.ts
```

## `codegraph export`

Export the code graph in various formats.

```bash
codegraph export [--format <fmt>] [--tokens <budget>] [--repo <name>]
```

Options:
- `--format` — Output format: `llm` (default), `json`, `dot`
- `--tokens` — Token budget for LLM format (default: 4096)
- `--repo` — Filter by repository name

Examples:
```bash
codegraph export                              # Compact LLM summary
codegraph export --format=json                # Full JSON graph
codegraph export --format=dot | dot -Tpng > graph.png  # Visualization
codegraph export --tokens=8192                # More detailed summary
```

## `codegraph summary`

Show a one-line project summary (file count, symbol count, languages).

```bash
codegraph summary
```

## `codegraph lang list`

List supported languages.

```bash
codegraph lang list
```

## `codegraph serve`

Start as an MCP server using stdio transport. Used by LLM tools like Claude Desktop, Cursor, or opencode.

```bash
codegraph serve
```
