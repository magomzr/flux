import {
  Controller,
  Get,
  Headers,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FlagCacheService } from '../services/flag-cache.service';
import { SseService } from '../services/sse.service';
import { UsageCounterService } from '../services/usage-counter.service';
import { SdkApiKeyGuard, getSdkContext } from '../guards/sdk-api-key.guard';
import { Public } from '../../../common/decorators/public.decorator';

@Public()
@Controller('sdk')
@UseGuards(SdkApiKeyGuard)
export class SdkController implements OnApplicationShutdown {
  constructor(
    private readonly flagCache: FlagCacheService,
    private readonly sseService: SseService,
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

  @Get('stream')
  stream(@Req() req: Request, @Res() res: Response) {
    const sdkCtx = getSdkContext(req as any);

    if (!sdkCtx.hasSse) {
      throw new ForbiddenException(
        'SSE is not available on your current plan. Upgrade to Standard or Pro.',
      );
    }

    const { environmentId } = sdkCtx;
    const subject = this.sseService.register(environmentId);

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    this.flagCache.getAll(environmentId).then(({ flags, etag }) => {
      res.write(`event: flags.snapshot\n`);
      res.write(`data: ${JSON.stringify({ flags, etag })}\n\n`);
    });

    const subscription = subject.subscribe({
      next: (event) => {
        if (event.type) res.write(`event: ${event.type}\n`);
        res.write(`data: ${event.data}\n\n`);
      },
      complete: () => res.end(),
      error: () => res.end(),
    });

    req.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
      this.sseService.unregister(environmentId, subject);
    });
  }

  onApplicationShutdown() {}
}
