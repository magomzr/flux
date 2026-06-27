import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { SubscribeDto } from '../dto/subscribe.dto';
import { CostEstimateDto } from '../dto/cost-estimate.dto';
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

  @Post('plans')
  @RequirePerms(Perm.BILLING_WRITE)
  createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Get('plans')
  @RequirePerms(Perm.BILLING_READ)
  findAllPlans() {
    return this.billingService.findAllPlans();
  }

  @Get('plans/:planId')
  @RequirePerms(Perm.BILLING_READ)
  findPlan(@Param('planId') planId: string) {
    return this.billingService.findPlan(planId);
  }

  @Get('billing/estimate')
  @RequirePerms(Perm.BILLING_READ)
  calculateCost(@Query() dto: CostEstimateDto) {
    return this.billingService.calculateCost(dto);
  }

  @Post('tenants/:tenantId/billing/subscribe')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_WRITE)
  subscribe(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.billingService.subscribe(tenantId, dto);
  }

  @Get('tenants/:tenantId/billing/subscription')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getActiveSubscription(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getActiveSubscription(tenantId);
  }

  @Get('tenants/:tenantId/billing/subscriptions')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getSubscriptionHistory(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getSubscriptionHistory(tenantId);
  }

  @Get('tenants/:tenantId/billing/usage')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getCurrentUsage(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getCurrentUsage(tenantId);
  }

  @Get('tenants/:tenantId/billing/usage/history')
  @UseGuards(TenantGuard)
  @TenantResource({ param: 'tenantId' })
  @RequirePerms(Perm.BILLING_READ)
  getUsageHistory(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.billingService.getUsageHistory(tenantId);
  }
}
