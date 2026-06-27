import { Global, Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
