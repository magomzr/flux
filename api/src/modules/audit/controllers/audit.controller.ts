import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
  @IsString()
  @IsOptional()
  entityType?: string;

  @IsUUID()
  @IsOptional()
  entityId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

@Controller('tenants/:tenantId/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
@TenantResource({ param: 'tenantId' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePerms(Perm.AUDIT_READ)
  query(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() queryDto: AuditQueryDto,
  ) {
    return this.auditService.query({ tenantId, ...queryDto });
  }
}
