import { createDirectoryStore } from '../app/directory-store.js';

// Capture read-only queries without inserting a sample person into the live database.
export async function directoryQueryChecks() {
  const queries = [];
  const db = { query: async (options, values = []) => {
    queries.push({ sql: options.sql, values });
    if (options.sql.startsWith('SELECT COUNT(*)')) return [{ total:0 }];
    if (options.sql.startsWith('SELECT p.id')) return [{ id:'00000000-0000-0000-0000-000000000000', archived_at:null }];
    return [];
  } };
  const store = createDirectoryStore(db);
  await store.search({ q:'query-check',topic:'query-check',region:'query-check',page:1,pageSize:20 });
  await store.profile('query-check');
  return queries;
}
