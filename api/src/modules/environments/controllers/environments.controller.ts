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
import { EnvironmentsService } from '../services/environments.service';
import { CreateEnvironmentDto } from '../dto/create-environment.dto';
import { UpdateEnvironmentDto } from '../dto/update-environment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';
import { buildAuditContext } from '../../../common/utils/request.utils';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'projectId', via: 'project' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEnvironmentDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.environmentsService.create(projectId, dto, buildAuditContext(req));
  }

  @Get()
  @RequirePerms(Perm.ENVIRONMENT_READ)
  @TenantResource({ param: 'projectId', via: 'project' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.environmentsService.findAllByProject(projectId);
  }

  @Get(':id')
  @RequirePerms(Perm.ENVIRONMENT_READ)
  @TenantResource({ param: 'id', via: 'environment' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.environmentsService.findOne(id);
  }

  @Patch(':id')
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'id', via: 'environment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnvironmentDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.environmentsService.update(id, dto, buildAuditContext(req));
  }

  @Delete(':id')
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'id', via: 'environment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.environmentsService.removePermanently(id, buildAuditContext(req));
  }
}
