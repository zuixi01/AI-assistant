import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AfterSalesService } from './after-sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin/after-sales')
@Controller('admin/after-sales')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AfterSalesController {
  constructor(private afterSalesService: AfterSalesService) {}

  @Get()
  @ApiOperation({ summary: '获取售后列表' })
  findAll(@Request() req, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.afterSalesService.findByTenant(req.user.tenantId, +page, +pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取售后详情' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.afterSalesService.findByOrderId(req.user.tenantId, id);
  }
}
