import { SetMetadata } from '@nestjs/common';
import type { TenantResolvable } from '../tenant/tenant-resolver.service';

export const TENANT_RESOURCE_KEY = 'tenantResource';

export interface TenantResourceMeta {
  param: string;
  via?: TenantResolvable;
}

export const TenantResource = (meta: TenantResourceMeta) =>
  SetMetadata(TENANT_RESOURCE_KEY, meta);
