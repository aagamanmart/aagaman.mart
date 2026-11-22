import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { admins, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyToken } from '../lib/security.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isBlocked: boolean;
}

export interface AuthRequest extends Request {
  dbUser?: DbUser;
  adminSession?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

export async function getOrCreateUserFromFirebase(
  uid: string,
  email: string,
  name?: string,
  photoUrl?: string,
  emailVerified?: boolean
): Promise<DbUser> {
  const result = await db
    .insert(users)
    .values({
      uid,
      email: email.toLowerCase(),
      name: name || email.split('@')[0] || 'Customer',
      photoUrl: photoUrl || '',
      emailVerified: Boolean(emailVerified),
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email.toLowerCase(),
        ...(name ? { name } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  const u = result[0];
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    name: u.name,
    phone: u.phone,
    photoUrl: u.photoUrl,
    role: u.role,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    isBlocked: u.isBlocked,
  };
}

async function resolveUserFromToken(token: string): Promise<DbUser | null> {
  // 1. Try custom signed customer Bearer token
  const customPayload = verifyToken(token);
  if (customPayload && customPayload.scope === 'customer' && typeof customPayload.userId === 'number') {
    const found = await db.select().from(users).where(eq(users.id, customPayload.userId)).limit(1);
    if (found[0]) {
      const u = found[0];
      return {
        id: u.id,
        uid: u.uid,
        email: u.email,
        name: u.name,
        phone: u.phone,
        photoUrl: u.photoUrl,
        role: u.role,
        emailVerified: u.emailVerified,
        phoneVerified: u.phoneVerified,
        isBlocked: u.isBlocked,
      };
    }
  }

  // 2. Try Firebase ID Token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) return null;
    return await getOrCreateUserFromFirebase(
      decoded.uid,
      decoded.email,
      decoded.name,
      decoded.picture,
      decoded.email_verified
    );
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.slice(7).trim();
  const user = await resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
  if (user.isBlocked) {
    return res.status(403).json({ error: 'Your account has been suspended. Please contact customer support.' });
  }
  req.dbUser = user;
  next();
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = await resolveUserFromToken(token);
    if (user && !user.isBlocked) {
      req.dbUser = user;
    }
  }
  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'admin' || typeof payload.adminId !== 'number') {
    return res.status(403).json({ error: 'Invalid or expired admin session.' });
  }

  if (payload.adminId === 0 && payload.envOverride === true) {
    req.adminSession = {
      id: 0,
      email: String(payload.email || 'admin@aagamanmart.in'),
      name: String(payload.name || 'Store Administrator'),
      role: 'super_admin',
    };
    return next();
  }

  const found = await db.select().from(admins).where(eq(admins.id, payload.adminId)).limit(1);
  if (!found[0] || !found[0].isActive) {
    return res.status(403).json({ error: 'Admin account not found or deactivated.' });
  }
  req.adminSession = {
    id: found[0].id,
    email: found[0].email,
    name: found[0].name,
    role: found[0].role,
  };
  next();
};
