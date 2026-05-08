import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { Db } from '../../../db';
import { users } from '../../../db/schema';
import { ROLE_PERMISSIONS } from '../../../common/config/roles.config';
import { LoginDto } from '../../auth/dto/login.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('DB') private readonly db: Db) {}

  private async findByEmail(email: string) {
    return this.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  public async findById(id: string) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  public getPermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  public async validateCredentials(dto: LoginDto) {
    const user = await this.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return user;
  }
}
