import { Controller, Post, Patch, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { Public } from '../../../common/decorators/public.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiResponse({ status: 200, description: 'Devuelve access_token y refresh_token' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva el access token usando el refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevo par de tokens' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoca el refresh token y toda su familia' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refresh_token);
  }
}

// Endpoint separado bajo /users/me para evitar conflicto con el interceptor
// que excluye /auth/* del token de autorización
@ApiTags('Me')
@Controller('users/me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario autenticado' })
  @ApiResponse({ status: 204, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.changePassword(req.user.sub, dto);
  }
}
