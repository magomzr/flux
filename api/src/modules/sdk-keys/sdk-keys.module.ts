import { Module } from '@nestjs/common';
import { SdkKeysController } from './controllers/sdk-keys.controller';
import { SdkKeysService } from './services/sdk-keys.service';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [DeliveryModule],
  controllers: [SdkKeysController],
  providers: [SdkKeysService],
})
export class SdkKeysModule {}
