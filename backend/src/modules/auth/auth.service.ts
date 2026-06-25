import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { ValidationError, UnauthorizedError } from '../../shared/middleware/error-handler.js';
import type { LoginRequest, RegisterRequest, AuthTokens } from '../../../../shared/types/index.js';

export class AuthService {
  /**
   * Generates JWT Access and Refresh tokens for a user containing their role
   */
  private static generateTokens(userId: string, email: string, role: string): AuthTokens {
    const accessToken = jwt.sign(
      { id: userId, email, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: userId, email, role },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    // Parse expiration in seconds (default is 15 minutes)
    const expiresIn = 15 * 60;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Registers a new hiker with password hashing, default role 'tourist', and optional medical info
   */
  public static async register(data: RegisterRequest & { medicalProfile?: any }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone || null,
        role: 'tourist', // Default for self-registered users
        medicalProfile: data.medicalProfile || null,
        privacyConsent: true,
        privacyConsentDate: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        fitnessLevel: true,
        locale: true,
        createdAt: true,
      },
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return { user, tokens };
  }

  /**
   * Logs in a user by validating credentials and returning tokens
   */
  public static async login(data: LoginRequest) {
    let user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    let isPasswordValid = false;
    let isAdminUser = false;
    let dbAdminUser: any = null;

    if (user && !user.deletedAt) {
      isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    } else {
      // Fallback to adminUser table
      dbAdminUser = await prisma.adminUser.findUnique({
        where: { email: data.email },
      });
      if (dbAdminUser && dbAdminUser.isActive) {
        isPasswordValid = await bcrypt.compare(data.password, dbAdminUser.passwordHash);
        isAdminUser = true;
      }
    }

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (isAdminUser && dbAdminUser) {
      // Map 'admin' role to 'operator' to match frontend expected types and prevent authorization issues
      const role = dbAdminUser.role === 'admin' ? 'operator' : dbAdminUser.role;
      const tokens = this.generateTokens(dbAdminUser.id, dbAdminUser.email, role);

      const userProfile = {
        id: dbAdminUser.id,
        email: dbAdminUser.email,
        fullName: dbAdminUser.fullName,
        phone: dbAdminUser.phone || undefined,
        role: role,
        avatarUrl: undefined,
        fitnessLevel: 'intermediate' as const,
        locale: 'it',
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
        privacyConsent: true,
        createdAt: dbAdminUser.createdAt.toISOString(),
      };

      return { user: userProfile, tokens };
    }

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    const userProfile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone || undefined,
      role: user.role,
      avatarUrl: user.avatarUrl || undefined,
      fitnessLevel: user.fitnessLevel as 'beginner' | 'intermediate' | 'advanced',
      locale: user.locale,
      emergencyContactName: user.emergencyContactName || undefined,
      emergencyContactPhone: user.emergencyContactPhone || undefined,
      privacyConsent: user.privacyConsent,
      createdAt: user.createdAt.toISOString(),
    };

    return { user: userProfile, tokens };
  }

  /**
   * Refreshes JWT tokens using a valid refresh token
   */
  public static async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string; email: string; role: string };

      // Ensure user still exists in either table
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (user && !user.deletedAt) {
        return this.generateTokens(user.id, user.email, user.role);
      }

      // Check adminUser table
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
      });

      if (adminUser && adminUser.isActive) {
        const role = adminUser.role === 'admin' ? 'operator' : adminUser.role;
        return this.generateTokens(adminUser.id, adminUser.email, role);
      }

      throw new UnauthorizedError('User no longer exists');
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }
}
