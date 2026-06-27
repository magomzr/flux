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
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { RequirePerms } from '../../../common/decorators/permissions.decorator';
import { TenantResource } from '../../../common/decorators/tenant-resource.decorator';
import { Perm } from '../../../common/config/roles.config';

@Controller('tenants/:tenantId/users')
@UseGuards(JwtAuthGuard, PermissionsGuard, TenantGuard)
@TenantResource({ param: 'tenantId' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePerms(Perm.USER_WRITE)
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(tenantId, dto);
  }

  @Get()
  @RequirePerms(Perm.USER_READ)
  findAll(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.usersService.findAllByTenant(tenantId);
  }

  @Get(':id')
  @RequirePerms(Perm.USER_READ)
  findOne(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findOneInTenant(id, tenantId);
  }

  @Patch(':id')
  @RequirePerms(Perm.USER_WRITE)
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @RequirePerms(Perm.USER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.remove(id, tenantId);
  }
}
