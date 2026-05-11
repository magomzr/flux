import type { Request } from 'express';
import type { RequestUser } from '../decorators/current-user.decorator';
import type { AuditContext } from '../../modules/audit/audit.types';

export function buildAuditContext(req: Request & { user: RequestUser }): AuditContext {
  return {
    userId:    req.user.sub,
    userEmail: req.user.email ?? null,
    tenantId:  req.user.tenantId,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? null,
  };
}
