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
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';
import { buildAuditContext } from '../../../common/utils/request.utils';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Controller('tenants/:tenantId/projects')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
@TenantResource({ param: 'tenantId' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePerms(Perm.PROJECT_WRITE)
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateProjectDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.create(
      { ...dto, tenantId },
      buildAuditContext(req),
    );
  }

  @Get()
  @RequirePerms(Perm.PROJECT_READ)
  findAllByTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.projectsService.findAllByTenant(tenantId);
  }

  @Get(':id')
  @RequirePerms(Perm.PROJECT_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @RequirePerms(Perm.PROJECT_WRITE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePerms(Perm.PROJECT_WRITE)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.deactivate(id, buildAuditContext(req));
  }

  @Delete(':id')
  @RequirePerms(Perm.PROJECT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.projectsService.removePermanently(id, buildAuditContext(req));
  }
}
