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
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { Perm } from '../../../common/config/roles.config';

@Controller('tenants/:tenantId/projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePerms(Perm.PROJECT_WRITE)
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create({ ...dto, tenantId });
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
  ) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @RequirePerms(Perm.PROJECT_WRITE)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.deactivate(id);
  }

  @Delete(':id')
  @RequirePerms(Perm.PROJECT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.removePermanently(id);
  }
}
