import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type BetterSqlite3 from 'better-sqlite3';
import * as schema from './schema.ts';

export type Db = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

const MIGRATIONS = resolve(import.meta.dirname, '..', '..', 'drizzle');

/** Ouvre la base et applique les migrations manquantes : une base existante garde ses données. */
export const openDatabase = (path: string): Db => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
};
