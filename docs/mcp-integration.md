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
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve", "--dir", "/path/to/your/project"]
    }
  }
}
```

Or with the compiled binary:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "/path/to/codegraph",
      "args": ["serve", "--dir", "/path/to/your/project"]
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
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve", "--dir", "/path/to/your/project"]
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
      "args": ["tsx", "/path/to/mem-project/src/main.ts", "serve", "--dir", "/path/to/your/project"]
    }
  }
}
```

## Available Tools

### `codegraph_scan`

Scans the codebase and builds/updates the graph.

**Parameters:**
- `dir` (string, optional): Target project directory

**When to use:** At the start of a session or after files have changed.

### `codegraph_query`

Searches for symbols by name pattern.

**Parameters:**
- `term` (string, required): Symbol name or pattern
- `dir` (string, optional): Target project directory

**When to use:** When you need to find where a class, function, or method is defined.

### `codegraph_dependencies`

Gets dependencies and reverse dependencies for a file.

**Parameters:**
- `file` (string, required): File path to analyze
- `dir` (string, optional): Target project directory

**When to use:** When you need to understand how a file relates to other files.

### `codegraph_export`

Exports a compact, token-efficient summary of the code graph.

**Parameters:**
- `format` (string, optional): `llm`, `json`, `dot`, or `svg` (default: `llm`)
- `tokens` (number, optional): Token budget for LLM format (default: 8192)
- `repo` (string, optional): Filter by repo name
- `dir` (string, optional): Target project directory

**When to use:** At the start of a session to get an overview of the codebase.

### `codegraph_status`

Checks what files have changed since the last scan.

**Parameters:**
- `dir` (string, optional): Target project directory

**When to use:** To determine if a re-scan is needed.
