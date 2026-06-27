import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyCacheService } from '../services/api-key-cache.service';
import type { CachedApiKey } from '../delivery.types';

export const SDK_KEY_CONTEXT = 'sdkKeyContext';

@Injectable()
export class SdkApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyCache: ApiKeyCacheService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'] as string | undefined;

    if (!rawKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const keyContext = await this.apiKeyCache.validate(rawKey);

    if (!keyContext) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request[SDK_KEY_CONTEXT] = keyContext;

    return true;
  }
}

export function getSdkContext(request: Record<string, unknown>): CachedApiKey {
  return request[SDK_KEY_CONTEXT] as CachedApiKey;
}
