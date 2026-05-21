# MCP Integration

CodeGraph can run as an MCP (Model Context Protocol) server, allowing LLM tools to interact with the code graph directly.

## Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve"]
    }
  }
}
```

### opencode

Add to your opencode configuration:

```json
{
  "mcp": {
    "codegraph": {
      "command": "npx",
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve"]
    }
  }
}
```

## Available Tools

### `codegraph_scan`

Scans the codebase and builds/updates the graph.

**Parameters:**
- `cwd` (string, optional): Working directory

**When to use:** At the start of a session or after files have changed.

### `codegraph_query`

Searches for symbols by name pattern.

**Parameters:**
- `term` (string, required): Symbol name or pattern
- `cwd` (string, optional): Working directory

**When to use:** When you need to find where a class, function, or method is defined.

### `codegraph_dependencies`

Gets dependencies and reverse dependencies for a file.

**Parameters:**
- `file` (string, required): File path to analyze
- `cwd` (string, optional): Working directory

**When to use:** When you need to understand how a file relates to other files.

### `codegraph_export`

Exports a compact, token-efficient summary of the code graph.

**Parameters:**
- `format` (string, optional): `llm` or `json` (default: `llm`)
- `tokens` (number, optional): Token budget (default: 4096)
- `repo` (string, optional): Filter by repo name
- `cwd` (string, optional): Working directory

**When to use:** At the start of a session to get an overview of the codebase.

### `codegraph_status`

Checks what files have changed since the last scan.

**Parameters:**
- `cwd` (string, optional): Working directory

**When to use:** To determine if a re-scan is needed.
