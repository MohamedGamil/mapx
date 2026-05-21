export interface StoreBackend {
  exec(sql: string): void;
  prepare(sql: string): PreparedStmt;
  pragma(pragma: string): void;
  close(): void;
  inTransaction<T>(fn: () => T): T;
}

export interface PreparedStmt {
  run(...args: unknown[]): void;
  get(...args: unknown[]): Record<string, unknown> | undefined;
  all(...args: unknown[]): Record<string, unknown>[];
}

export function createDatabasePath(workspaceRoot: string): string {
  const path = await import('node:path');
  return path.join(workspaceRoot, '.codegraph', 'codegraph.db');
}
