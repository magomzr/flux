import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans/:planId')
  @RequirePerms(Perm.BILLING_READ)
  findPlan(@Param('planId') planId: string) {
    return this.billingService.findPlan(planId);
  }

  @Get('tenants/:tenantId/billing/subscription')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getActiveSubscription(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getActiveSubscription(tenantId);
  }

  @Get('tenants/:tenantId/billing/usage')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getCurrentUsage(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getCurrentUsage(tenantId);
  }
}
