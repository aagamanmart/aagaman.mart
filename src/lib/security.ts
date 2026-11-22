import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  var _aagamanSigningKey: Buffer | undefined;
  var _aagamanRateMap: Map<string, number[]> | undefined;
}

function getSigningKey(): Buffer {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return Buffer.from(process.env.SESSION_SECRET, 'utf-8');
  }
  if (!global._aagamanSigningKey) {
    global._aagamanSigningKey = crypto.randomBytes(32);
  }
  return global._aagamanSigningKey;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as Record<string, unknown>;
    if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  if (!global._aagamanRateMap) {
    global._aagamanRateMap = new Map();
  }
  const store = global._aagamanRateMap;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const hits = (store.get(key) || []).filter((ts) => now - ts < windowMs);
    if (hits.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a moment.' });
    }
    hits.push(now);
    store.set(key, hits);
    next();
  };
}
