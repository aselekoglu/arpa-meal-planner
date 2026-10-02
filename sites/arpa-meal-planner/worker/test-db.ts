import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';

export function testDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  const result = (sql: string, args: unknown[]) => {
    const statement = sqlite.prepare(sql);
    if (statement.reader) return { success: true, results: statement.all(...args), meta: { changes: 0 } };
    const r = statement.run(...args);
    return { success: true, results: [], meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } };
  };
  const prepare = (sql: string, args: unknown[] = []): any => ({
    sql, args, bind: (...values: unknown[]) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => result(sql, args), run: async () => result(sql, args),
  });
  const db = { prepare, batch: async (statements: any[]) => sqlite.transaction(() => statements.map(s => result(s.sql, s.args)))() } as unknown as D1Database;
  return { sqlite, db };
}
