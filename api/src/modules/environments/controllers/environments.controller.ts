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
import { EnvironmentsService } from '../services/environments.service';
import { CreateEnvironmentDto } from '../dto/create-environment.dto';
import { UpdateEnvironmentDto } from '../dto/update-environment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  // POST y GET usan projectId → resolver via 'project'
  @Post()
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'projectId', via: 'project' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(projectId, dto);
  }

  @Get()
  @RequirePerms(Perm.ENVIRONMENT_READ)
  @TenantResource({ param: 'projectId', via: 'project' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.environmentsService.findAllByProject(projectId);
  }

  // GET/PATCH/DELETE por :id usan el environmentId → resolver via 'environment'
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
  ) {
    return this.environmentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'id', via: 'environment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(@Param('id', ParseUUIDPipe) id: string) {
    return this.environmentsService.removePermanently(id);
  }
}
