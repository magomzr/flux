import { Global, Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantGuard } from '../guards/tenant.guard';

@Global()
@Module({
  providers: [TenantResolverService, TenantGuard],
  exports: [TenantResolverService, TenantGuard],
})
export class TenantModule {}
