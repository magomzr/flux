import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  name: string;
  tenantId: string | null;
  role: string;
  permissions: string[];
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_PUBLIC_KEY'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      name: payload.name,
      tenantId: payload.tenantId,
      role: payload.role,
      permissionSet: new Set<string>(payload.permissions),
    };
  }
}
