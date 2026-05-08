import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest();
    const permSet: Set<string> = user?.permissionSet;

    if (!permSet) throw new UnauthorizedException();

    const hasAll = required.every((p) => permSet.has(p));
    if (!hasAll) throw new ForbiddenException();

    return true;
  }
}
