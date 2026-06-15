import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  findAll(@Request() req, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.usersService.findByTenant(req.user.tenantId, +page, +pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.usersService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户信息' })
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.usersService.update(req.user.tenantId, id, body);
  }
}
