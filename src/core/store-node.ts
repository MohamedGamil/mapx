import type { StoreBackend, PreparedStmt } from './store-interface.js';

export class NodeStore implements StoreBackend {
  private db: any;

  constructor(dbPath: string) {
    const Database = require('better-sqlite3');
    this.db = new Database(dbPath);
    this.pragma('journal_mode = WAL');
    this.pragma('foreign_keys = ON');
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStmt {
    const stmt = this.db.prepare(sql);
    return {
      run: (...args: unknown[]) => stmt.run(...args),
      get: (...args: unknown[]) => stmt.get(...args) as Record<string, unknown> | undefined,
      all: (...args: unknown[]) => stmt.all(...args) as Record<string, unknown>[],
    };
  }

  pragma(pragma: string): void {
    this.db.pragma(pragma);
  }

  inTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}
