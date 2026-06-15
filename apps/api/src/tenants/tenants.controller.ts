import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建租户' })
  create(@Body() body: { name: string; slug: string; type: string; plan?: string }) {
    return this.tenantsService.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取租户列表' })
  findAll() {
    return this.tenantsService.findAll();
  }

  /** 必须放在 @Get(':id') 之前，否则 `GET /tenants/slug` 会被当成 `:id = "slug"` */
  @Get('slug/:slug')
  @ApiOperation({ summary: '通过 slug 获取租户' })
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取租户详情' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新租户' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.tenantsService.update(id, body);
  }

  @Post(':id/plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新套餐' })
  updatePlan(@Param('id') id: string, @Body() body: { plan: string }) {
    return this.tenantsService.updatePlan(id, body.plan);
  }

  @Get(':id/plan-limits')
  @ApiOperation({ summary: '获取套餐限制' })
  async getPlanLimits(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);
    return this.tenantsService.getPlanLimits(tenant.plan);
  }

  @Get(':id/usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用量统计' })
  getUsage(@Param('id') id: string) {
    return this.tenantsService.getUsage(id);
  }

  @Get(':id/check-limit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查资源限制' })
  checkLimit(@Param('id') id: string, @Query('resource') resource: string) {
    return this.tenantsService.checkLimit(id, resource);
  }
}
