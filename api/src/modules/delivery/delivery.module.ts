import { Module } from '@nestjs/common';
import { SdkController } from './controllers/sdk.controller';
import { FlagCacheService } from './services/flag-cache.service';
import { ApiKeyCacheService } from './services/api-key-cache.service';
import { SseService } from './services/sse.service';
import { UsageCounterService } from './services/usage-counter.service';
import { SdkApiKeyGuard } from './guards/sdk-api-key.guard';

@Module({
  controllers: [SdkController],
  providers: [
    FlagCacheService,
    ApiKeyCacheService,
    SseService,
    UsageCounterService,
    SdkApiKeyGuard,
  ],
  exports: [FlagCacheService, ApiKeyCacheService, SseService],
})
export class DeliveryModule {}
