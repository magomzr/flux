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
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from '../services/tenants.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Perm } from '../../../common/config/roles.config';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { UpdateTenantDto } from '../dto/update.tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @RequirePerms(Perm.TENANT_INSERT)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @RequirePerms(Perm.TENANT_DELETE)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deactivate(id);
  }

  @Delete(':id')
  @RequirePerms(Perm.TENANT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.removePermanently(id);
  }
}
