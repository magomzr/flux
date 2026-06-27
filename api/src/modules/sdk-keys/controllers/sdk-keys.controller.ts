import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SdkKeysService } from '../services/sdk-keys.service';
import { CreateSdkKeyDto } from '../dto/create-sdk-key.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';
import { buildAuditContext } from '../../../common/utils/request.utils';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Controller('projects/:projectId/environments/:environmentId/keys')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
export class SdkKeysController {
  constructor(private readonly sdkKeysService: SdkKeysService) {}

  @Post()
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'environmentId', via: 'environment' })
  create(
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Body() dto: CreateSdkKeyDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.sdkKeysService.create(
      environmentId,
      dto,
      buildAuditContext(req),
    );
  }

  @Get()
  @RequirePerms(Perm.ENVIRONMENT_READ)
  @TenantResource({ param: 'environmentId', via: 'environment' })
  findAll(@Param('environmentId', ParseUUIDPipe) environmentId: string) {
    return this.sdkKeysService.findAllByEnvironment(environmentId);
  }

  @Post(':id/revoke')
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'environmentId', via: 'environment' })
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.sdkKeysService.revoke(id, buildAuditContext(req));
  }

  @Delete(':id')
  @RequirePerms(Perm.ENVIRONMENT_WRITE)
  @TenantResource({ param: 'environmentId', via: 'environment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.sdkKeysService.removePermanently(id, buildAuditContext(req));
  }
}
