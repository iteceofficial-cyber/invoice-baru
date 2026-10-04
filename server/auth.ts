import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, runQuery } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'inv_secret_super_key_2026_modern_secure';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_active: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Autentikasi gagal: Token tidak ditemukan' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = queryOne<AuthUser>(
      `SELECT u.id, u.username, u.email, u.full_name, u.role_id, u.is_active, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid atau akun dinonaktifkan' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi telah kedaluwarsa atau token tidak sah' });
  }
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role_name !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak: Fitur ini khusus Super Admin' });
  }
  next();
}

export function logActivity(userId: number | null, username: string, action: string, details: string, ipAddress?: string) {
  try {
    runQuery(
      `INSERT INTO activity_logs (user_id, username, action, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [userId, username, action, details, ipAddress || '127.0.0.1']
    );
  } catch (err) {
    console.error('Error recording activity log:', err);
  }
}
