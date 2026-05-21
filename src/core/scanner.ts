import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, relative, extname, join } from 'node:path';
import { Store } from './store.js';
import { CodeGraph } from './graph.js';
import { Config } from './config.js';
import { getParserForFile } from '../parsers/parser-registry.js';
import { getLanguageForFile } from '../languages/registry.js';
import { getGitBlobHashes, getChangedFiles, getCurrentCommitSha, isGitRepo } from './git-tracker.js';
import type { ScanResult, GraphEdge, ParseResult, ExtractedReference, ExtractedSymbol } from '../types.js';

const DEFAULT_IGNORE = new Set([
  'node_modules', 'vendor', '.git', 'dist', '.codegraph', '__pycache__',
  '.next', '.nuxt', 'coverage', '.cache', '.turbo', 'target', 'build',
  '.gradle', '.idea', '.vscode', '.vs',
]);

export class Scanner {
  private store: Store;
  private config: Config;
  private graph: CodeGraph;

  constructor(store: Store, config: Config, graph: CodeGraph) {
    this.store = store;
    this.config = config;
    this.graph = graph;
  }

  async scanFull(): Promise<ScanResult> {
    const startTime = Date.now();
    const workspaceRoot = this.config.getWorkspaceRoot();
    const repo = this.config.repo;
    const repoRoot = resolve(workspaceRoot, repo.path);

    const files = await this.walkDirectory(repoRoot, repo.path);
    const langBreakdown: Record<string, number> = {};
    let totalSymbols = 0;
    let totalEdges = 0;

    const gitHashes = isGitRepo(repoRoot) ? getGitBlobHashes(repoRoot) : new Map<string, string>();

    this.store.inTransaction(() => {
      for (const fileInfo of files) {
        const relativePath = relative(workspaceRoot, fileInfo.absolutePath).replace(/\\/g, '/');
        const blobHash = gitHashes.get(relativePath) || null;

        this.store.upsertFile({
          path: relativePath,
          repo: repo.name,
          language: fileInfo.language,
          gitBlobHash: blobHash,
          lastScanned: new Date().toISOString(),
          sizeBytes: fileInfo.sizeBytes,
          lines: fileInfo.lines,
        });

        this.graph.addFileNode(relativePath, fileInfo.language, fileInfo.sizeBytes, fileInfo.lines);

        langBreakdown[fileInfo.language] = (langBreakdown[fileInfo.language] || 0) + 1;
      }
    });

    for (const fileInfo of files) {
      const relativePath = relative(workspaceRoot, fileInfo.absolutePath).replace(/\\/g, '/');
      const result = await this.parseAndIndex(relativePath, fileInfo.absolutePath, repo.name);

      totalSymbols += result.symbols.length;
      totalEdges += result.references.length;
    }

    const commitSha = isGitRepo(repoRoot) ? getCurrentCommitSha(repoRoot) : null;
    if (commitSha) {
      this.store.setMeta('last_scan_commit', commitSha);
    }
    this.store.setMeta('last_scan_time', new Date().toISOString());

    const durationMs = Date.now() - startTime;

    return {
      filesScanned: files.length,
      symbolsFound: totalSymbols,
      edgesFound: totalEdges,
      durationMs,
      languageBreakdown: langBreakdown,
    };
  }

  async scanIncremental(): Promise<ScanResult> {
    const startTime = Date.now();
    const workspaceRoot = this.config.getWorkspaceRoot();
    const repo = this.config.repo;
    const repoRoot = resolve(workspaceRoot, repo.path);

    if (!isGitRepo(repoRoot)) {
      return this.scanFull();
    }

    const lastCommit = this.store.getMeta('last_scan_commit');
    const changes = getChangedFiles(repoRoot, lastCommit || undefined);

    if (changes.length === 0) {
      return {
        filesScanned: 0,
        symbolsFound: 0,
        edgesFound: 0,
        durationMs: Date.now() - startTime,
        languageBreakdown: {},
      };
    }

    let totalSymbols = 0;
    let totalEdges = 0;
    const langBreakdown: Record<string, number> = {};

    for (const change of changes) {
      const relativePath = change.path.replace(/\\/g, '/');

      if (change.status === 'removed') {
        this.store.inTransaction(() => {
          this.store.deleteFile(relativePath);
        });
        continue;
      }

      const absolutePath = resolve(workspaceRoot, relativePath);
      const fileInfo = await this.getFileInfo(absolutePath, relativePath);
      if (!fileInfo) continue;

      this.store.inTransaction(() => {
        this.store.deleteSymbolsForFile(relativePath);
        this.store.deleteEdgesForFile(relativePath);
        this.store.upsertFile({
          path: relativePath,
          repo: repo.name,
          language: fileInfo.language,
          gitBlobHash: null,
          lastScanned: new Date().toISOString(),
          sizeBytes: fileInfo.sizeBytes,
          lines: fileInfo.lines,
        });
      });

      const result = await this.parseAndIndex(relativePath, absolutePath, repo.name);
      totalSymbols += result.symbols.length;
      totalEdges += result.references.length;
      langBreakdown[fileInfo.language] = (langBreakdown[fileInfo.language] || 0) + 1;
    }

    const commitSha = getCurrentCommitSha(repoRoot);
    if (commitSha) {
      this.store.setMeta('last_scan_commit', commitSha);
    }
    this.store.setMeta('last_scan_time', new Date().toISOString());

    return {
      filesScanned: changes.length,
      symbolsFound: totalSymbols,
      edgesFound: totalEdges,
      durationMs: Date.now() - startTime,
      languageBreakdown: langBreakdown,
    };
  }

  private async parseAndIndex(relativePath: string, absolutePath: string, repoName: string): Promise<ParseResult> {
    const source = await readFile(absolutePath, 'utf-8');
    const parser = getParserForFile(relativePath, this.config.getResolvedUserLanguages());

    const result = await parser.parse(relativePath, source);

    this.store.inTransaction(() => {
      this.store.deleteSymbolsForFile(relativePath);

      for (const sym of result.symbols) {
        this.graph.addSymbolNode(
          sym.name, relativePath, sym.name, sym.kind,
          sym.startLine, sym.endLine, sym.scope
        );

        this.store.insertSymbol({
          filePath: relativePath,
          repo: repoName,
          name: sym.name,
          kind: sym.kind,
          scope: sym.scope,
          signature: sym.signature,
          startLine: sym.startLine,
          endLine: sym.endLine,
          metadata: JSON.stringify(sym.metadata),
        });
      }

      this.store.deleteEdgesForFile(relativePath);

      const resolvedRefs = this.resolveReferences(result.references, relativePath, repoName);
      for (const edge of resolvedRefs) {
        this.graph.addDependencyEdge(edge);
        this.store.insertEdge(edge);
      }
    });

    return result;
  }

  private resolveReferences(refs: ExtractedReference[], sourcePath: string, repoName: string): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const allFiles = this.store.getAllFiles(repoName);
    const fileMap = new Map<string, string>();
    for (const f of allFiles) {
      fileMap.set(f.path as string, f.path as string);
    }

    for (const ref of refs) {
      let targetFile: string | null = null;

      if (ref.referenceType === 'require') {
        targetFile = this.resolveRequirePath(ref.targetName, sourcePath, fileMap);
      } else if (ref.referenceType === 'import') {
        targetFile = this.resolveImportPath(ref.targetName, sourcePath, fileMap);
      } else {
        targetFile = this.resolveSymbolToFile(ref.targetName, fileMap);
      }

      if (targetFile) {
        edges.push({
          sourceFile: sourcePath,
          targetFile,
          sourceSymbol: ref.sourceSymbol,
          targetSymbol: ref.targetName,
          edgeType: ref.referenceType,
          repo: repoName,
          weight: 1.0,
        });
      }
    }

    return edges;
  }

  private resolveRequirePath(target: string, sourcePath: string, fileMap: Map<string, string>): string | null {
    const dir = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : '';
    const candidates = [
      target.startsWith('./') ? join(dir, target) : target,
      target.startsWith('./') ? join(dir, target + '.php') : target,
      target + '.php',
    ];

    for (const candidate of candidates) {
      const normalized = candidate.replace(/\\/g, '/').replace(/^\.\//, '');
      if (fileMap.has(normalized)) return normalized;
    }
    return null;
  }

  private resolveImportPath(target: string, sourcePath: string, fileMap: Map<string, string>): string | null {
    const candidates = [
      target.replace(/^\.\//, ''),
      target + '/index.js',
      target + '/index.ts',
      target + '.js',
      target + '.ts',
    ];

    for (const candidate of candidates) {
      if (fileMap.has(candidate)) return candidate;
    }
    return null;
  }

  private resolveSymbolToFile(symbolName: string, fileMap: Map<string, string>): string | null {
    const matches = this.store.searchSymbols(symbolName);
    if (matches.length > 0) {
      return matches[0].file_path as string;
    }
    return null;
  }

  private async walkDirectory(dir: string, repoPath: string): Promise<Array<{
    absolutePath: string;
    language: string;
    sizeBytes: number;
    lines: number;
  }>> {
    const files: Array<{
      absolutePath: string;
      language: string;
      sizeBytes: number;
      lines: number;
    }> = [];

    const workspaceRoot = this.config.getWorkspaceRoot();
    const excludePatterns = this.config.settings.excludePatterns;

    const walk = async (currentDir: string) => {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (DEFAULT_IGNORE.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.codegraph') continue;

        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = relative(workspaceRoot, fullPath).replace(/\\/g, '/');
          if (this.shouldExclude(relativePath, excludePatterns)) continue;

          const langDef = getLanguageForFile(fullPath, this.config.getResolvedUserLanguages());
          if (!langDef) continue;

          try {
            const stats = await stat(fullPath);
            const content = await readFile(fullPath, 'utf-8');
            const lines = content.split('\n').length;

            files.push({
              absolutePath: fullPath,
              language: langDef.name,
              sizeBytes: stats.size,
              lines,
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    };

    await walk(dir);
    return files;
  }

  private shouldExclude(path: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        if (regex.test(path)) return true;
      } else {
        if (path.includes(pattern)) return true;
      }
    }
    return false;
  }

  private async getFileInfo(absolutePath: string, relativePath: string) {
    const langDef = getLanguageForFile(absolutePath, this.config.getResolvedUserLanguages());
    if (!langDef) return null;

    try {
      const stats = await stat(absolutePath);
      const content = await readFile(absolutePath, 'utf-8');

      return {
        absolutePath,
        language: langDef.name,
        sizeBytes: stats.size,
        lines: content.split('\n').length,
      };
    } catch {
      return null;
    }
  }
}
