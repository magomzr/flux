import { SetMetadata } from '@nestjs/common';
import type { TenantResolvable } from '../tenant/tenant-resolver.service';

export const TENANT_RESOURCE_KEY = 'tenantResource';

export interface TenantResourceMeta {
  /**
   * Nombre del param en la ruta que contiene el ID relevante.
   * Ejemplos: 'tenantId', 'projectId', 'id'
   */
  param: string;

  /**
   * Si el param NO es directamente un tenantId, indica qué entidad
   * resolver para obtenerlo. Omitir cuando el param ya es el tenantId.
   */
  via?: TenantResolvable;
}

/**
 * Marca un controller o handler para que TenantGuard verifique ownership.
 *
 * @example
 * // El param 'tenantId' ya es el tenantId → verificación directa
 * @TenantResource({ param: 'tenantId' })
 *
 * @example
 * // El param 'projectId' necesita resolverse via DB
 * @TenantResource({ param: 'projectId', via: 'project' })
 *
 * @example
 * // El param 'id' es un environmentId
 * @TenantResource({ param: 'id', via: 'environment' })
 */
export const TenantResource = (meta: TenantResourceMeta) =>
  SetMetadata(TENANT_RESOURCE_KEY, meta);
