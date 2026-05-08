import { Global, Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantGuard } from '../guards/tenant.guard';

/**
 * Módulo global que provee TenantResolverService y TenantGuard.
 * Al ser global, cualquier módulo puede inyectar TenantGuard sin importarlo.
 */
@Global()
@Module({
  providers: [TenantResolverService, TenantGuard],
  exports: [TenantResolverService, TenantGuard],
})
export class TenantModule {}
