import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TENANT_RESOURCE_KEY,
  TenantResourceMeta,
} from '../decorators/tenant-resource.decorator';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import type { RequestUser } from '../decorators/current-user.decorator';

// Roles internos que pueden operar sobre cualquier tenant
const INTERNAL_ROLES = new Set(['super_admin', 'ops']);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<TenantResourceMeta>(
      TENANT_RESOURCE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Si no hay metadata, el guard no aplica (ruta no marcada)
    if (!meta) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // Roles internos pasan siempre
    if (INTERNAL_ROLES.has(user.role)) return true;

    if (!user.tenantId) {
      throw new ForbiddenException('No tenant associated with this user');
    }

    const paramValue: string = request.params[meta.param];

    // Resolver el tenantId del recurso
    const resourceTenantId = meta.via
      ? await this.tenantResolver.resolveTenantId(meta.via, paramValue)
      : paramValue; // el param ya es el tenantId

    if (resourceTenantId !== user.tenantId) {
      throw new ForbiddenException(
        'You do not have access to this resource',
      );
    }

    return true;
  }
}
