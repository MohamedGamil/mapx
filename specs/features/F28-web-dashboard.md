# F28 — Bundled Web Dashboard

| Field | Value |
|-------|-------|
| ID | F28 |
| Status | `planned` |
| Iteration | I15 |
| Branch | `feat/i15-web-dashboard` |
| Depends on | F13 (npm dist, ensures bundled assets ship) |
| Richer with | F02 (metrics), F14/F15 (clusters), F16 (data flow), F18 (git), F19 (smart context), F21–F26 (routes) |

---

## Problem

mapx exposes rich graph data through the CLI and MCP tools, but there is no human-facing visual interface. Developers who want to:

- **Explore** the codebase structure without reading CLI output
- **Watch** which MCP tools an AI agent is calling in real time
- **Track** scan health, last-scan time, and stale-file indicators
- **Browse** metrics (PageRank, coupling, change frequency) across files and symbols
- **Visualize** clusters, route graphs, and data flow paths
- **Build context** interactively for an upcoming task

…must construct that picture mentally from JSON output or exported SVG files. A bundled dashboard eliminates that friction and makes mapx observable for both humans and AI pair-programming workflows.

---

## Goal

Ship a lightweight, self-contained web dashboard that is **optionally** served alongside the existing MCP server or standalone. The dashboard has zero runtime framework dependencies in the server path (Node.js built-ins only) and a minimal client bundle (< 200 KB gzipped).

```
mapx ui                   # dashboard on http://localhost:4000 (auto-opens browser)
mapx ui --port 4001       # custom port
mapx ui --no-open         # suppress auto-open
mapx ui --host 0.0.0.0   # bind all interfaces (warns: insecure)
mapx ui --token <secret>  # require Authorization: Bearer <secret>
mapx serve --ui           # MCP server + dashboard in a single process
```

---

## Dashboard sections

### 1. Overview / Status

A summary panel shown at the top of every page:

| Field | Source |
|-------|--------|
| Repository name | `mapx status` |
| Last scanned | scan timestamp |
| Files indexed | file count |
| Symbols indexed | symbol count |
| Edges indexed | edge count |
| Languages detected | language breakdown with percentages |
| Stale files | files modified since last scan (from F18 git tracker if available) |
| Scan health | `healthy` / `stale` / `never scanned` indicator with colour |

Clicking the health indicator triggers a live `mapx update` and streams progress via SSE.

### 2. Graph Explorer

An interactive force-directed graph of the codebase:

- **Nodes** = files; size ∝ PageRank score; colour = language
- **Edges** = dependency edges; colour = edge type (import, call, route, extends, etc.)
- **Cluster outlines** = module/domain clusters (F14) drawn as convex hulls when available
- **Click node** → side-panel shows: file path, language, symbol list, top metrics
- **Click edge** → side-panel shows: edge type, source/target symbols, verifiability, weight
- **Filters**: language toggle, cluster toggle, edge-type toggle, minimum PageRank slider
- **Search box**: highlight and zoom to a file or symbol by name
- **Layout toggle**: force-directed (default), dagre hierarchical, radial
- **Export button**: triggers `mapx export --format=svg` and downloads the resulting `.svg`

For large codebases (> 500 nodes), the graph is progressively loaded: render top-N files by PageRank first, with a "load more" affordance.

### 3. Symbol Explorer

A searchable, sortable table of all indexed symbols:

| Column | Description |
|--------|-------------|
| Name | Symbol name (links to detail panel) |
| Kind | `class` / `function` / `method` / `interface` / `enum` / `type` / `route` / … |
| File | Relative path (links to file detail) |
| Scope | Parent class/namespace |
| PageRank | Numeric score |
| In-degree | Number of incoming edges |
| Out-degree | Number of outgoing edges |

Clicking a row opens a detail panel with:
- Source code snippet (first N lines if available via `mapx_node`)
- Callers list (from `mapx_callers` / F19)
- Callees list (from `mapx_callees` / F19)
- Impact summary (from `mapx_impact` / F19)

### 4. Tool Call Log

A live, scrollable log of MCP tool calls intercepted from the running MCP server:

| Column | Description |
|--------|-------------|
| Time | ISO timestamp |
| Tool | Tool name (e.g. `mapx_context`) |
| Arguments | Collapsed JSON — expand on click |
| Result size | Byte count / estimated tokens of response |
| Latency | Duration in ms |
| Status | `ok` / `error` |

- Populated via SSE stream (`GET /events?stream=tool-calls`)
- **Filter** by tool name; **search** in arguments
- **Pause/Resume** toggle
- **Clear** button
- Shows a "no MCP server running" placeholder when `mapx ui` is used standalone (without `mapx serve --ui`)

### 5. Metrics Panel

Derived analytics surfaced as tables and mini-charts:

**Top files by PageRank** (table + horizontal bar chart)
**Top symbols by PageRank** (table + horizontal bar chart)
**Coupling summary** (from F02 when available):
- Afferent coupling (Ca): how many modules depend on this one
- Efferent coupling (Ce): how many modules this one depends on
- Instability index: `Ce / (Ca + Ce)`

**Language breakdown** (donut chart)
**Edge type breakdown** (donut chart: import vs call vs route vs extends vs …)
**Change frequency heat map** (from F18 git commit count per file, if available): colour-coded file list ranked by recent change frequency

### 6. Context Viewer

An interactive panel for exploring smart context (powered by F19 tools when available):

- **Task input box**: type a task description (e.g. "add rate limiting to API endpoints")
- **`Build context` button**: calls `/api/context?task=<query>` → displays ranked file list with relevance scores
- **Symbol lookup**: type a symbol name → shows callers, callees, impact radius inline
- **Route explorer**: if F21–F26 route data is available, shows a filterable route table (`GET /api/routes`) with method, path, handler, framework columns; clicking a route highlights it in the Graph Explorer

---

## Server architecture

### New source files

```
src/ui-server.ts          ← HTTP server (static assets + REST API + SSE)
src/ui-events.ts          ← EventEmitter shared between MCP interceptor and UI server
src/ui/                   ← Dashboard client source (compiled to dist/ui/)
  index.html
  main.ts                 ← Client entry point (bundled)
  styles.css
  components/
    graph-view.ts         ← Force-directed graph renderer (D3 / Cytoscape)
    symbol-table.ts
    tool-log.ts
    metrics-panel.ts
    context-viewer.ts
    status-bar.ts
  lib/
    sse-client.ts         ← SSE subscription helper
    api.ts                ← Typed fetch wrappers for /api/* endpoints
    graph-layout.ts       ← Layout adapters (force / dagre / radial)
scripts/
  build-ui.ts             ← Bundles src/ui/ → dist/ui/ (esbuild or rollup)
```

### Modified source files

```
src/cli.ts                ← add `mapx ui` command + `mapx serve --ui` flag
src/mcp.ts                ← wrap tool handlers to emit events to ui-events
src/main.ts               ← wire mapx ui into command dispatch
```

### HTTP routes served by `ui-server.ts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve `dist/ui/index.html` |
| `GET` | `/assets/*` | Serve bundled JS/CSS/fonts |
| `GET` | `/api/status` | JSON: scan status, file/symbol/edge counts, language breakdown |
| `GET` | `/api/graph?limit=N&lang=X&cluster=Y` | JSON: paginated file nodes + edges (same data as `mapx export --format=json`) |
| `GET` | `/api/symbols?q=X&kind=Y&limit=N&offset=O` | JSON: symbol search results |
| `GET` | `/api/symbol/:name` | JSON: single symbol detail (callers, callees, source snippet) |
| `GET` | `/api/metrics` | JSON: PageRank rankings, coupling scores, edge-type breakdown |
| `GET` | `/api/context?task=X` | JSON: smart context for a task (proxies `ContextBuilder` from F19) |
| `GET` | `/api/routes?framework=X&method=Y` | JSON: route table (available when F21–F26 data is present) |
| `GET` | `/events` | SSE stream: `tool-call`, `scan-progress`, `scan-complete`, `error` events |

All `/api/*` and `/events` paths are protected by the optional bearer token (checked in a shared middleware function at the top of the request handler).

### SSE event envelope

```json
{ "event": "tool-call",
  "data": {
    "ts": "2026-05-22T10:01:23.456Z",
    "tool": "mapx_context",
    "args": { "task": "add rate limiting" },
    "resultBytes": 3214,
    "tokensEstimated": 803,
    "latencyMs": 47,
    "status": "ok"
  }
}
```

```json
{ "event": "scan-progress",
  "data": { "phase": "parse", "filesScanned": 34, "filesTotal": 142 }
}
```

```json
{ "event": "scan-complete",
  "data": { "files": 142, "symbols": 1847, "edges": 4231, "durationMs": 2140 }
}
```

### MCP tool call interception (`src/mcp.ts`)

Wrap each tool handler with a thin timing shim that emits on the shared `UiEventBus` (imported from `ui-events.ts`). The bus is a singleton `EventEmitter`; if no dashboard is running the emitted events are silently dropped (no performance overhead beyond the emit call).

```typescript
// Pseudocode — actual implementation in src/mcp.ts
function wrapTool(name: string, handler: ToolHandler): ToolHandler {
  return async (args) => {
    const t0 = Date.now();
    try {
      const result = await handler(args);
      uiEventBus.emit('tool-call', { tool: name, args, result, latencyMs: Date.now() - t0, status: 'ok' });
      return result;
    } catch (err) {
      uiEventBus.emit('tool-call', { tool: name, args, error: String(err), latencyMs: Date.now() - t0, status: 'error' });
      throw err;
    }
  };
}
```

---

## Client bundle

### Tech choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Graph rendering | **Cytoscape.js** (~150 KB min+gz) | Battle-tested, supports force/dagre/radial layouts; no canvas required |
| Layout algorithms | `cytoscape-dagre`, `cytoscape-fcose` | Dagre for hierarchical, fCoSE for force-directed |
| Charts | **uPlot** (~15 KB) or hand-drawn SVG bars | Minimal; only bar + donut charts needed |
| Bundler | **esbuild** (already a dev dep in the project) | Fast, zero-config, produces single-file bundle |
| Styling | Vanilla CSS custom properties | No CSS framework dependency; dark/light mode via `prefers-color-scheme` |
| State | No framework — plain TypeScript modules with DOM manipulation | Avoids React/Vue/Svelte runtime in the client bundle |
| SSE | Native `EventSource` API | No polyfill needed for Node 18+, all modern browsers |

Target bundle size: < 200 KB gzipped (Cytoscape + layout plugins + uPlot + app code).

### Build step

```typescript
// scripts/build-ui.ts
import { build } from 'esbuild';

await build({
  entryPoints: ['src/ui/main.ts'],
  bundle: true,
  minify: true,
  outfile: 'dist/ui/main.js',
  target: ['es2020'],
  external: [],          // everything bundled — no CDN references
});
// Copy index.html + styles.css → dist/ui/
```

`build-ui.ts` is invoked by the existing `Makefile` / `scripts/build-all.ts` as part of the full build. A `--no-ui` environment flag (or `MAPX_NO_UI=1`) skips the client build for minimal/CI installs.

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Default bind address | `127.0.0.1` only — never `0.0.0.0` unless `--host` is explicitly passed |
| `--host 0.0.0.0` | Print a prominent warning: `⚠ Dashboard bound to 0.0.0.0 — accessible on all network interfaces` |
| Authentication | Optional `--token <secret>` flag. All `/api/*` and `/events` requests must include `Authorization: Bearer <secret>`; reject with `401` otherwise. The token is never logged or shown in the browser URL |
| Path traversal | Static file serving resolves paths relative to `dist/ui/` only; reject any path containing `..` |
| Sensitive data | API responses contain only data already available via `mapx export` (no secrets, no env vars, no file contents beyond symbols) |
| Source snippets | `GET /api/symbol/:name` may return source lines; scope strictly to the project directory; reject paths outside project root |
| CORS | Only allow `Origin: http://localhost:<port>` — reject cross-origin requests |

---

## `mapx ui` CLI integration

### New command: `mapx ui`

```
mapx ui [options]

Options:
  --port <n>          HTTP port (default: 4000)
  --host <addr>       Bind address (default: 127.0.0.1)
  --no-open           Do not open the browser automatically
  --token <secret>    Require Authorization: Bearer <secret> for API and SSE
  --dir <path>        Target project directory (default: cwd)
```

Startup sequence:
1. Load/open the mapx store for the target directory
2. Start `UiServer` (HTTP + SSE)
3. Print: `  mapx dashboard  →  http://localhost:4000`
4. Auto-open the URL in the default browser (unless `--no-open`)
5. Watch for `Ctrl-C` and close the HTTP server gracefully

### Extended command: `mapx serve --ui`

When both `--ui` and MCP flags are present, start both the JSON-RPC MCP endpoint and the HTTP dashboard in the same process, sharing the same store and `UiEventBus`:

```
mapx serve --ui --port 3456 --ui-port 4000 --dir .
```

Both servers start concurrently. The MCP tool wrappers emit to `UiEventBus`, which the dashboard SSE stream subscribes to.

---

## Progressive enhancement

The dashboard degrades gracefully when optional features are absent:

| Feature absent | Graceful fallback |
|----------------|------------------|
| F02 (metrics) | Metrics panel shows only PageRank; coupling section shows "metrics not available — run `mapx metrics`" |
| F14/F15 (clusters) | Graph Explorer renders without cluster outlines |
| F16 (data flow) | No data flow overlay in Graph Explorer |
| F18 (git) | Change frequency heat map hidden; stale-file indicator shows "git data unavailable" |
| F19 (smart context) | Context Viewer shows "smart context tools not available — install mapx with F19 support" |
| F21–F26 (routes) | Route Explorer tab hidden |
| MCP server not running | Tool Call Log shows "no active MCP server — start with `mapx serve --ui`" |

---

## Build and distribution

### npm package changes (`package.json`)

- Add `dist/ui/` to the `files` array so dashboard assets are shipped in the npm package
- Add `scripts/build-ui.ts` to the build pipeline in `Makefile` and `scripts/build-all.ts`
- Add `cytoscape`, `cytoscape-dagre`, `cytoscape-fcose` as build-time bundled dependencies (not runtime `dependencies`) — they are compiled into `dist/ui/main.js`, so they do not appear in the consumer's `node_modules`
- Add `uplot` (or equivalent) as a bundled dep

### `MAPX_NO_UI=1` environment flag

When set, `scripts/build-all.ts` skips the client build step. Useful for CI environments where the dashboard is not needed.

---

## Acceptance Criteria

- [ ] `mapx ui` starts an HTTP server and prints the URL
- [ ] `mapx ui` opens the default browser unless `--no-open` is passed
- [ ] Dashboard loads without errors in Chrome, Firefox, and Safari (latest)
- [ ] Graph Explorer renders nodes and edges for a project with ≥ 10 files
- [ ] Node size reflects PageRank; node colour reflects language
- [ ] Clicking a node opens a side-panel with the file's symbol list
- [ ] Symbol Explorer table renders and is searchable by name
- [ ] Tool Call Log is empty by default; populates in real time when `mapx serve --ui` is used and an MCP tool is called
- [ ] SSE stream reconnects automatically if the connection drops
- [ ] Metrics Panel shows PageRank rankings for files and symbols
- [ ] `--token <secret>` rejects requests without a valid `Authorization: Bearer` header (401)
- [ ] `--host 0.0.0.0` prints a visible warning
- [ ] Static file serving rejects paths containing `..`
- [ ] CORS rejects cross-origin requests from non-localhost origins
- [ ] `mapx serve --ui` starts both MCP and dashboard in one process; tool calls appear in Tool Call Log
- [ ] `dist/ui/` is included in the published npm package
- [ ] `MAPX_NO_UI=1 make build` completes without building client assets
- [ ] Dashboard bundle is < 200 KB gzipped
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `mapx ui --help` prints usage
