import { Store } from '../core/store.js';
import { CodeGraph } from '../core/graph.js';

export class GraphExporter {
  private store: Store;
  private graph: CodeGraph;

  constructor(store: Store, graph: CodeGraph) {
    this.store = store;
    this.graph = graph;
  }

  exportAsJSON(repo?: string): object {
    const files = this.store.getAllFiles(repo);
    const symbols = this.store.getAllSymbols(repo);
    const edges = this.store.getAllEdges(repo);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      repo: repo || 'all',
      summary: {
        totalFiles: files.length,
        totalSymbols: symbols.length,
        totalEdges: edges.length,
        languages: this.store.getLanguageBreakdown(repo),
      },
      files: files.map(f => ({
        path: f.path,
        language: f.language,
        sizeBytes: f.size_bytes,
        lines: f.lines,
        lastScanned: f.last_scanned,
      })),
      symbols: symbols.map(s => ({
        name: s.name,
        kind: s.kind,
        scope: s.scope || undefined,
        signature: s.signature,
        file: s.file_path,
        line: s.start_line,
        endLine: s.end_line,
      })),
      edges: edges.map(e => ({
        source: e.source_file,
        target: e.target_file,
        type: e.edge_type,
        sourceSymbol: e.source_symbol || undefined,
        targetSymbol: e.target_symbol || undefined,
      })),
      graph: this.graph.toJSON(),
    };
  }

  exportAsJSONString(repo?: string): string {
    return JSON.stringify(this.exportAsJSON(repo), null, 2);
  }
}
