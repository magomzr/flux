import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthController } from './modules/health/health.controller';
import { DbModule } from './db/db.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { FlagsModule } from './modules/flags/flags.module';
import { AuditModule } from './modules/audit/audit.module';
import { BillingModule } from './modules/billing/billing.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { SdkKeysModule } from './modules/sdk-keys/sdk-keys.module';
import { TenantModule } from './common/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: false }),
    DbModule,
    TenantModule,
    AuditModule,
    AuthModule,
    TenantsModule,
    ProjectsModule,
    EnvironmentsModule,
    FlagsModule,
    BillingModule,
    DeliveryModule,
    SdkKeysModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
