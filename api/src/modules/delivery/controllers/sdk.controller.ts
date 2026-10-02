import {
  Controller,
  Get,
  Headers,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FlagCacheService } from '../services/flag-cache.service';
import { UsageCounterService } from '../services/usage-counter.service';
import { SdkApiKeyGuard, getSdkContext } from '../guards/sdk-api-key.guard';
import { Public } from '../../../common/decorators/public.decorator';

@Public()
@Controller('sdk')
@UseGuards(SdkApiKeyGuard)
export class SdkController implements OnApplicationShutdown {
  constructor(
    private readonly flagCache: FlagCacheService,
    private readonly usageCounter: UsageCounterService,
  ) {}

  @Get('flags')
  async getAllFlags(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ) {
    const { environmentId } = getSdkContext(req as any);

    if (ifNoneMatch) {
      const currentEtag = await this.flagCache.getEtag(environmentId);
      if (ifNoneMatch === `"${currentEtag}"`) {
        return res.status(304).end();
      }
    }

    const { flags, etag } = await this.flagCache.getAll(environmentId);

    this.usageCounter.increment(getSdkContext(req as any).tenantId);

    return res
      .set('ETag', `"${etag}"`)
      .set('Cache-Control', 'no-cache')
      .json(flags);
  }

  @Get('flags/:key')
  async getFlag(@Req() req: Request, @Param('key') key: string) {
    const { environmentId } = getSdkContext(req as any);
    const flag = await this.flagCache.getOne(environmentId, key);

    if (!flag) {
      throw new NotFoundException(`Flag "${key}" not found`);
    }

    this.usageCounter.increment(getSdkContext(req as any).tenantId);

    return flag;
  }

  onApplicationShutdown() {}
}
