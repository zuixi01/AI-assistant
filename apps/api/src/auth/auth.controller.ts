import { Controller, Post, Body, Get, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ADMIN_AUTH_COOKIE, buildAdminClearCookieOptions, buildAdminCookieOptions } from './auth.config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie(ADMIN_AUTH_COOKIE, result.accessToken, buildAdminCookieOptions());
    return { admin: result.admin };
  }

  @Post('logout')
  @ApiOperation({ summary: '管理员退出登录' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_AUTH_COOKIE, buildAdminClearCookieOptions());
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@Request() req) {
    return {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      tenantId: req.user.tenantId,
    };
  }
}
