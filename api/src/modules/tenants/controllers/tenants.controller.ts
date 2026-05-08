import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantsService } from '../services/tenants.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update.tenant.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { Perm } from '../../../common/config/roles.config';
import { buildAuditContext } from '../../../common/utils/request.utils';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @RequirePerms(Perm.TENANT_INSERT)
  create(
    @Body() dto: CreateTenantDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.tenantsService.create(dto, buildAuditContext(req));
  }

  @Get()
  @RequirePerms(Perm.TENANT_READ)
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @RequirePerms(Perm.TENANT_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @RequirePerms(Perm.TENANT_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.tenantsService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePerms(Perm.TENANT_DELETE)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.tenantsService.deactivate(id, buildAuditContext(req));
  }

  @Delete(':id')
  @RequirePerms(Perm.TENANT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.tenantsService.removePermanently(id, buildAuditContext(req));
  }
}
