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

  /**
   * GET /sdk/flags
   * Devuelve todos los flags del ambiente autenticado.
   *
   * Soporta conditional GET con ETag:
   *   - Si el cliente envía If-None-Match y el ETag coincide → 304 Not Modified
   *   - Si cambió → 200 con nuevo payload y ETag
   *
   * Hot path: O(1) desde cache en memoria.
   */
  @Get('flags')
  async getAllFlags(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ) {
    const { environmentId } = getSdkContext(req as any);

    // Conditional GET — si el ETag no cambió, 304 sin body
    if (ifNoneMatch) {
      const currentEtag = await this.flagCache.getEtag(environmentId);
      if (ifNoneMatch === `"${currentEtag}"`) {
        return res.status(304).end();
      }
    }

    const { flags, etag } = await this.flagCache.getAll(environmentId);

    // Incrementar contador de evaluaciones — no bloqueante, O(1)
    this.usageCounter.increment(getSdkContext(req as any).tenantId);

    return res
      .set('ETag', `"${etag}"`)
      .set('Cache-Control', 'no-cache') // el cliente debe revalidar siempre
      .json(flags);
  }

  /**
   * GET /sdk/flags/:key
   * Devuelve un flag específico por key.
   * Hot path: O(1) lookup en Map.
   */
  @Get('flags/:key')
  async getFlag(
    @Req() req: Request,
    @Param('key') key: string,
  ) {
    const { environmentId } = getSdkContext(req as any);
    const flag = await this.flagCache.getOne(environmentId, key);

    if (!flag) {
      throw new NotFoundException(`Flag "${key}" not found`);
    }

    // Incrementar contador también en evaluación individual
    this.usageCounter.increment(getSdkContext(req as any).tenantId);

    return flag;
  }

  /**
   * GET /sdk/stream
   * SSE — notificaciones en tiempo real cuando cambian los flags.
   * Solo disponible en plan standard+.
   *
   * El cliente recibe eventos del tipo "flags.changed" con el environmentId
   * y opcionalmente el flagKey que cambió.
   */
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

    // Headers SSE estándar
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // desactiva buffering en nginx
    });
    res.flushHeaders();

    // Heartbeat cada 30s para mantener la conexión viva
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    // Enviar evento inicial con el estado actual
    this.flagCache.getAll(environmentId).then(({ flags, etag }) => {
      res.write(`event: flags.snapshot\n`);
      res.write(`data: ${JSON.stringify({ flags, etag })}\n\n`);
    });

    // Suscribir al subject y pushear eventos al cliente
    const subscription = subject.subscribe({
      next: (event) => {
        if (event.type) res.write(`event: ${event.type}\n`);
        res.write(`data: ${event.data}\n\n`);
      },
      complete: () => res.end(),
      error: () => res.end(),
    });

    // Limpiar cuando el cliente desconecta
    req.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
      this.sseService.unregister(environmentId, subject);
    });
  }

  onApplicationShutdown() {
    // Al apagar el servidor, el SseService completa todos los subjects
    // via sus propios listeners de shutdown
  }
}
