import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminsService } from './admins.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admins')
@Controller('admins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminsController {
  constructor(private adminsService: AdminsService) {}

  @Post()
  @ApiOperation({ summary: '创建管理员' })
  create(@Request() req, @Body() body: { email: string; password: string; name?: string; role?: string }) {
    return this.adminsService.create(req.user.tenantId, body.email, body.password, body.name, body.role);
  }

  @Get()
  @ApiOperation({ summary: '获取管理员列表' })
  findAll(@Request() req) {
    return this.adminsService.findByTenant(req.user.tenantId);
  }
}
