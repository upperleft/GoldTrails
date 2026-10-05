import mariadb from 'mariadb';

export function connectionOptions(env = process.env) {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  if (required.every(key => !env[key])) return null;
  if (required.some(key => !env[key])) throw new Error('Database settings incomplete');
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid database port');
  const local = ['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST);
  if (!local && env.DB_SSL !== 'true') throw new Error('Remote database requires verified TLS');
  return {
    host: env.DB_HOST, port, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? (env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : true) : undefined,
    connectionLimit: 4, minimumIdle: 0, connectTimeout: 3000, acquireTimeout: 5000,
    socketTimeout: 10000, timezone: '+00:00', dateStrings: true,
    initSql: ["SET time_zone = '+00:00'", "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"],
  };
}

export function createDatabase(env = process.env) {
  const options = connectionOptions(env);
  if (!options) return null;
  const pool = mariadb.createPool(options);
  // Never log connector messages: they can contain connection details or SQL values.
  pool.on('error', () => console.error('Gold Trails database connection unavailable'));
  return pool;
}
