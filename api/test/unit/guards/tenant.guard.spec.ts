import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildContext(overrides: {
  role?: string;
  tenantId?: string | null;
  params?: Record<string, string>;
  meta?: object | null;
}): ExecutionContext {
  const {
    role = 'tenant_admin',
    tenantId = 'tenant-1',
    params = {},
    meta,
  } = overrides;

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: { role, tenantId, permissionSet: new Set() },
        params,
      }),
    }),
    // meta se inyecta via Reflector mock
    _meta: meta,
  } as unknown as ExecutionContext;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockResolver = {
  resolveTenantId: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TenantGuard,
        Reflector,
        { provide: TenantResolverService, useValue: mockResolver },
      ],
    }).compile();

    guard = module.get(TenantGuard);
    reflector = module.get(Reflector);
    jest.clearAllMocks();
  });

  // ─── No metadata ─────────────────────────────────────────────────────────────

  it('passes when no TenantResource metadata is set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const ctx = buildContext({});

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ─── Internal roles ──────────────────────────────────────────────────────────

  it('passes for super_admin regardless of tenant', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ param: 'tenantId' });
    const ctx = buildContext({
      role: 'super_admin',
      tenantId: null,
      params: { tenantId: 'any-tenant' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockResolver.resolveTenantId).not.toHaveBeenCalled();
  });

  it('passes for ops regardless of tenant', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ param: 'tenantId' });
    const ctx = buildContext({
      role: 'ops',
      tenantId: null,
      params: { tenantId: 'any-tenant' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ─── Direct tenantId param ───────────────────────────────────────────────────

  it('passes when tenantId param matches user tenantId', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ param: 'tenantId' });
    const ctx = buildContext({
      role: 'tenant_admin',
      tenantId: 'tenant-1',
      params: { tenantId: 'tenant-1' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when tenantId param does not match', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ param: 'tenantId' });
    const ctx = buildContext({
      role: 'tenant_admin',
      tenantId: 'tenant-1',
      params: { tenantId: 'tenant-2' }, // diferente tenant
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no tenantId', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ param: 'tenantId' });
    const ctx = buildContext({
      role: 'developer',
      tenantId: null, // sin tenant
      params: { tenantId: 'tenant-1' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ─── Via resolver ─────────────────────────────────────────────────────────────

  it('passes when resolved tenantId matches user tenantId', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      param: 'projectId',
      via: 'project',
    });
    mockResolver.resolveTenantId.mockResolvedValue('tenant-1');

    const ctx = buildContext({
      role: 'tenant_admin',
      tenantId: 'tenant-1',
      params: { projectId: 'project-1' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockResolver.resolveTenantId).toHaveBeenCalledWith(
      'project',
      'project-1',
    );
  });

  it('throws ForbiddenException when resolved tenantId does not match', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      param: 'projectId',
      via: 'project',
    });
    mockResolver.resolveTenantId.mockResolvedValue('tenant-2'); // otro tenant

    const ctx = buildContext({
      role: 'developer',
      tenantId: 'tenant-1',
      params: { projectId: 'project-99' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});

// ─── PermissionsGuard ─────────────────────────────────────────────────────────

import { TenantGuard } from '../../../src/common/guards/tenant.guard';
import { TenantResolverService } from '../../../src/common/tenant/tenant-resolver.service';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get(PermissionsGuard);
    reflector = module.get(Reflector);
  });

  function buildPermCtx(permissions: string[], required: string[] | null) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { permissionSet: new Set(permissions) },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('passes when no permissions are required', () => {
    const ctx = buildPermCtx(['read:flag'], null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user has all required permissions', () => {
    const ctx = buildPermCtx(
      ['read:flag', 'write:flag'],
      ['read:flag', 'write:flag'],
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user is missing a permission', () => {
    const ctx = buildPermCtx(['read:flag'], ['read:flag', 'write:flag']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when user has no permissionSet', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read:flag']);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: {} }), // sin permissionSet
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
