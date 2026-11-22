import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { addresses, notifications, users } from '../../db/schema.ts';
import { createRateLimiter, hashPassword, signToken, verifyPassword } from '../../lib/security.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';

export const authRouter = Router();
const authLimiter = createRateLimiter(60_000, 20);

authRouter.post('/auth/firebase-sync', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

authRouter.post('/auth/register', authLimiter, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(10).max(16).optional().default(''),
    password: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid registration details. Password must be at least 6 characters.' });
  }

  try {
    const normalizedEmail = parsed.data.email.toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing[0]) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const uid = `cust_${crypto.randomUUID()}`;
    const passwordHash = hashPassword(parsed.data.password);
    const [created] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        passwordHash,
        emailVerified: false,
      })
      .returning();

    await db.insert(notifications).values({
      userId: created.id,
      channel: 'email',
      type: 'registration',
      title: 'Welcome to AAGAMAN MART',
      message: `Hello ${created.name}, your account is active. Use WELCOME200 on your first order for ₹200 off!`,
    });

    const token = signToken({ scope: 'customer', userId: created.id, uid: created.uid });
    res.status(201).json({
      token,
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        name: created.name,
        phone: created.phone,
        photoUrl: created.photoUrl,
        role: created.role,
        emailVerified: created.emailVerified,
        phoneVerified: created.phoneVerified,
        isBlocked: created.isBlocked,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

authRouter.post('/auth/login', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter valid email and password.' });
  }

  try {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);

    const user = found[0];
    if (!user || !user.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
    }

    const token = signToken({ scope: 'customer', userId: user.id, uid: user.uid });
    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        phone: user.phone,
        photoUrl: user.photoUrl,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed.' });
  }
});

authRouter.post('/auth/forgot-password', authLimiter, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }

  try {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);

    if (found[0]) {
      const resetToken = crypto.randomInt(100000, 999999).toString();
      const resetExpiresAt = new Date(Date.now() + 15 * 60_000);
      await db
        .update(users)
        .set({ resetToken, resetExpiresAt, updatedAt: new Date() })
        .where(eq(users.id, found[0].id));

      return res.json({
        ok: true,
        message: 'A 6-digit password reset code has been generated.',
        sandboxCode: process.env.SMTP_HOST ? undefined : resetToken,
      });
    }

    res.json({ ok: true, message: 'If an account matches this email, a reset code was issued.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process reset request.' });
  }
});

authRouter.post('/auth/reset-password', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(4),
    newPassword: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide email, reset code, and a 6+ character new password.' });
  }

  try {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);

    const user = found[0];
    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== parsed.data.code.trim() ||
      !user.resetExpiresAt ||
      user.resetExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(parsed.data.newPassword),
        resetToken: null,
        resetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

authRouter.get('/account/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [addrRows, notifRows] = await Promise.all([
      db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(30),
    ]);

    res.json({
      user: req.dbUser,
      addresses: addrRows,
      notifications: notifRows,
    });
  } catch (error) {
    console.error('Fetch account error:', error);
    res.status(500).json({ error: 'Failed to load account profile.' });
  }
});

authRouter.put('/account/profile', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    phone: z.string().max(20).optional().default(''),
    photoUrl: z.string().max(500).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile fields.' });
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        photoUrl: parsed.data.photoUrl.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.dbUser!.id))
      .returning();

    res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        photoUrl: updated.photoUrl,
        role: updated.role,
        emailVerified: updated.emailVerified,
        phoneVerified: updated.phoneVerified,
        isBlocked: updated.isBlocked,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

authRouter.post('/account/verify-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, req.dbUser!.id));
    res.json({ ok: true, emailVerified: true });
  } catch {
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

authRouter.post('/account/send-otp', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ phone: z.string().min(10).max(16) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
  }

  try {
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60_000);
    await db
      .update(users)
      .set({ phone: parsed.data.phone.trim(), otpCode, otpExpiresAt, updatedAt: new Date() })
      .where(eq(users.id, req.dbUser!.id));

    res.json({
      ok: true,
      message: 'OTP sent to your mobile number.',
      sandboxOtp: process.env.TWILIO_ACCOUNT_SID ? undefined : otpCode,
    });
  } catch {
    res.status(500).json({ error: 'Failed to send mobile OTP.' });
  }
});

authRouter.post('/account/verify-otp', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ otp: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter the 6-digit OTP.' });
  }

  try {
    const found = await db.select().from(users).where(eq(users.id, req.dbUser!.id)).limit(1);
    const user = found[0];
    if (
      !user ||
      !user.otpCode ||
      user.otpCode !== parsed.data.otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    await db
      .update(users)
      .set({ phoneVerified: true, otpCode: null, otpExpiresAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ ok: true, phoneVerified: true });
  } catch {
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

authRouter.post('/account/change-password', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().optional().default(''),
    newPassword: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const found = await db.select().from(users).where(eq(users.id, req.dbUser!.id)).limit(1);
    const user = found[0];
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    if (user.passwordHash && !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(parsed.data.newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

authRouter.get('/account/addresses', requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, req.dbUser!.id))
    .orderBy(desc(addresses.isDefault));
  res.json({ addresses: rows });
});

authRouter.post('/account/addresses', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2).max(100),
    phone: z.string().min(10).max(16),
    line1: z.string().min(4).max(200),
    line2: z.string().max(200).optional().default(''),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(80),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Valid 6-digit Indian pincode required'),
    landmark: z.string().max(120).optional().default(''),
    addressType: z.enum(['Home', 'Work', 'Other']).default('Home'),
    isDefault: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid address.' });
  }

  try {
    if (parsed.data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.dbUser!.id));
    }
    const [created] = await db
      .insert(addresses)
      .values({ ...parsed.data, userId: req.dbUser!.id })
      .returning();
    res.status(201).json({ address: created });
  } catch {
    res.status(500).json({ error: 'Failed to save address.' });
  }
});

authRouter.delete('/account/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid address ID.' });
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, req.dbUser!.id)));
  res.json({ ok: true });
});

authRouter.patch('/account/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.dbUser!.id)));
  res.json({ ok: true });
});
