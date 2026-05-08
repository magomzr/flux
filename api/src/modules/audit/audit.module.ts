import { Global, Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';

/**
 * Global para que cualquier módulo pueda inyectar AuditService
 * sin necesidad de importar AuditModule explícitamente.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
