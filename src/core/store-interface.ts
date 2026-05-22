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

import { join } from 'node:path';

export function createDatabasePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.codegraph', 'codegraph.db');
}
