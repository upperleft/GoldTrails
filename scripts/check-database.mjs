import { createDatabase } from '../app/database.js';
import { directoryQueryChecks } from './directory-query-checks.mjs';
let db;
try {
  db = createDatabase();
  if (!db) throw new Error();
  const rows = await db.query("SELECT version FROM schema_migrations WHERE version='001_directory_foundation'");
  if (rows.length !== 1) throw new Error();
  for (const { sql, values } of await directoryQueryChecks()) await db.query({ sql, timeout:8000 }, values);
  console.log('Gold Trails database connection, migration and directory search verified.');
} catch {
  console.error('Database check failed. Verify the server-only settings and migration in Hostinger. No secrets were printed.');
  process.exitCode = 1;
} finally { if (db) await db.end(); }
