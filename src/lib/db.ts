import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function getDbDir(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data');
}

function getDbFile(): string {
  return path.join(getDbDir(), 'slynk.db');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = getDbDir();
  const dbFile = getDbFile();

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_mappings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      epos_id       TEXT NOT NULL,
      woo_id        INTEGER NOT NULL,
      epos_name     TEXT,
      woo_name      TEXT,
      last_synced   TEXT,
      UNIQUE(epos_id),
      UNIQUE(woo_id)
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      type        TEXT NOT NULL,
      status      TEXT NOT NULL,
      message     TEXT,
      details     TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_schedules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      cron        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      last_run    TEXT,
      next_run    TEXT
    );
  `);

  // Seed default schedules if none exist
  const count = (db.prepare('SELECT COUNT(*) as c FROM sync_schedules').get() as { c: number }).c;
  if (count === 0) {
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Products (every 30 min)', '*/30 * * * *', 1);
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Orders (every hour)', '0 * * * *', 1);
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Inventory (every 15 min)', '*/15 * * * *', 1);
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value);
}

export function addLog(
  type: string,
  status: 'success' | 'error' | 'info',
  message: string,
  details?: unknown
): void {
  getDb()
    .prepare(
      `INSERT INTO sync_logs (type, status, message, details) VALUES (?, ?, ?, ?)`
    )
    .run(type, status, message, details ? JSON.stringify(details) : null);
}

export function getLogs(limit = 100): SyncLog[] {
  return getDb()
    .prepare('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as SyncLog[];
}

export interface SyncLog {
  id: number;
  created_at: string;
  type: string;
  status: string;
  message: string;
  details: string | null;
}

export interface ProductMapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

export function getProductMappings(): ProductMapping[] {
  return getDb()
    .prepare('SELECT * FROM product_mappings ORDER BY epos_name')
    .all() as ProductMapping[];
}

export function upsertProductMapping(
  eposId: string,
  wooId: number,
  eposName: string,
  wooName: string
): void {
  getDb()
    .prepare(
      `INSERT INTO product_mappings (epos_id, woo_id, epos_name, woo_name, last_synced)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(epos_id) DO UPDATE SET
         woo_id = excluded.woo_id,
         woo_name = excluded.woo_name,
         last_synced = excluded.last_synced`
    )
    .run(eposId, wooId, eposName, wooName);
}

export function deleteProductMapping(id: number): void {
  getDb().prepare('DELETE FROM product_mappings WHERE id = ?').run(id);
}

export function deleteProductMappingByEposId(eposId: string): void {
  getDb().prepare('DELETE FROM product_mappings WHERE epos_id = ?').run(eposId);
}
