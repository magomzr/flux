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
import { FlagsService } from '../services/flags.service';
import { CreateFlagDto } from '../dto/create-flag.dto';
import { UpdateFlagDto } from '../dto/update-flag.dto';
import { UpdateFlagValueDto } from '../dto/update-flag-value.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';
import { buildAuditContext } from '../../../common/utils/request.utils';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Controller('projects/:projectId/flags')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Post()
  @RequirePerms(Perm.FLAG_WRITE)
  @TenantResource({ param: 'projectId', via: 'project' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateFlagDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.flagsService.create(projectId, dto, buildAuditContext(req));
  }

  @Get()
  @RequirePerms(Perm.FLAG_READ)
  @TenantResource({ param: 'projectId', via: 'project' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.flagsService.findAllByProject(projectId);
  }

  @Get(':id')
  @RequirePerms(Perm.FLAG_READ)
  @TenantResource({ param: 'id', via: 'flag' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flagsService.findOne(id);
  }

  @Patch(':id')
  @RequirePerms(Perm.FLAG_WRITE)
  @TenantResource({ param: 'id', via: 'flag' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlagDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.flagsService.update(id, dto, buildAuditContext(req));
  }

  @Delete(':id')
  @RequirePerms(Perm.FLAG_WRITE)
  @TenantResource({ param: 'id', via: 'flag' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.flagsService.removePermanently(id, buildAuditContext(req));
  }

  @Get(':flagId/values/:environmentId')
  @RequirePerms(Perm.FLAG_READ)
  @TenantResource({ param: 'flagId', via: 'flag' })
  getFlagValue(
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
  ) {
    return this.flagsService.getFlagValue(flagId, environmentId);
  }

  @Patch(':flagId/values/:environmentId')
  @RequirePerms(Perm.FLAG_WRITE)
  @TenantResource({ param: 'flagId', via: 'flag' })
  updateFlagValue(
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Body() dto: UpdateFlagValueDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.flagsService.updateFlagValue(
      flagId,
      environmentId,
      dto,
      buildAuditContext(req),
    );
  }

  @Post(':flagId/values/:environmentId/publish')
  @RequirePerms(Perm.FLAG_PUBLISH)
  @TenantResource({ param: 'flagId', via: 'flag' })
  publishFlagValue(
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.flagsService.publishFlagValue(
      flagId,
      environmentId,
      buildAuditContext(req),
    );
  }
}
