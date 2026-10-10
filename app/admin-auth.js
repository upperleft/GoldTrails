import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
const options = { N:131072, r:8, p:1, maxmem:160 * 1024 * 1024 };
export async function hashPassword(password, { minLength = 15 } = {}) {
  if (typeof password !== 'string' || password.length < minLength || password.length > 128) throw new Error(`Use ${minLength}–128 characters`);
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(password,salt,64,options)).toString('hex')}`;
}
export function validHash(hash) { return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || ''); }
export async function verifyPassword(password, hash) {
  if (!validHash(hash) || typeof password !== 'string' || password.length > 128) return false;
  const [,salt,expected] = hash.split(':');
  return timingSafeEqual(await derive(password,salt,64,options),Buffer.from(expected,'hex'));
}
export function adminConfig(env = process.env) {
  if (!env.ADMIN_USERNAME || !validHash(env.ADMIN_PASSWORD_HASH) || !env.ADMIN_ORIGIN) return null;
  const url = new URL(env.ADMIN_ORIGIN);
  if (url.protocol !== 'https:' || url.origin !== env.ADMIN_ORIGIN || url.username || url.password || env.ADMIN_USERNAME.length > 180) return null;
  return { username:env.ADMIN_USERNAME, passwordHash:env.ADMIN_PASSWORD_HASH, origin:url.origin };
}
export function sessionCookie(value, age=28800) {
  return `__Host-gold-admin=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
}
export function readCookie(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)__Host-gold-admin=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
