import { Module } from '@nestjs/common';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';
import { BillingSeed } from './billing.seed';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingSeed],
  exports: [BillingService],
})
export class BillingModule {}
