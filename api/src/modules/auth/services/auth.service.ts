import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { and, eq, isNull } from 'drizzle-orm';
import { LoginDto } from '../dto/login.dto';
import { UsersService } from '../../users/services/users.service';
import { refreshTokens, users } from '../../../db/schema';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { Db } from '../../../db';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    @Inject('DB') private readonly db: Db,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.validateCredentials(dto);
    const permissions = this.users.getPermissions(user.role);

    const accessToken = this.signAccessToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId ?? null,
      role: user.role,
      permissions,
    });

    const refreshToken = await this.buildRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken.raw,
    };
  }

  async refresh(rawToken: string) {
    const stored = await this.findRefreshToken(rawToken);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.revokeFamilyTokens(stored.familyId);
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (new Date() > stored.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.revokeRefreshToken(stored.id);

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const permissions = this.users.getPermissions(user.role);

    const accessToken = this.signAccessToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId ?? null,
      role: user.role,
      permissions,
    });

    const newRefreshToken = await this.buildRefreshToken(
      user.id,
      stored.familyId,
    );

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken.raw,
    };
  }

  async logout(rawToken: string) {
    const stored = await this.findRefreshToken(rawToken);
    if (stored) {
      await this.revokeFamilyTokens(stored.familyId);
    }
  }

  private signAccessToken(payload: {
    sub: string;
    name: string;
    email: string;
    tenantId: string | null;
    role: string;
    permissions: string[];
  }): string {
    return this.jwt.sign(payload);
  }

  private async buildRefreshToken(userId: string, familyId?: string) {
    const raw = `${userId}:${randomBytes(40).toString('hex')}`;
    const tokenHash = await bcrypt.hash(raw, 10);
    const family = familyId ?? randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.saveRefreshToken({
      userId,
      tokenHash,
      familyId: family,
      expiresAt,
    });

    return { raw, familyId: family };
  }

  private async saveRefreshToken(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(refreshTokens).values({
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      expiresAt: data.expiresAt,
    });
  }

  private async findRefreshToken(rawToken: string) {
    const [userId] = rawToken.split(':');
    if (!userId) return null;

    const candidates = await this.db.query.refreshTokens.findMany({
      where: and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
      ),
    });

    for (const candidate of candidates) {
      const match = await bcrypt.compare(rawToken, candidate.tokenHash);
      if (match) return candidate;
    }

    return null;
  }

  private async revokeRefreshToken(id: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  private async revokeFamilyTokens(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match)
      throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.db
      .update(users)
      .set({ password: newHash })
      .where(eq(users.id, userId));
  }
}
