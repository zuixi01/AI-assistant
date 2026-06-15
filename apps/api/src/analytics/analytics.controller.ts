import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin/analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '获取数据看板' })
  getDashboard(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getDashboard(req.user.tenantId, days ? parseInt(days, 10) : undefined);
  }

  @Get('intent-distribution')
  @ApiOperation({ summary: '意图分布统计' })
  getIntentDistribution(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getIntentDistribution(req.user.tenantId, days ? parseInt(days) : undefined);
  }

  @Get('after-sale')
  @ApiOperation({ summary: '售后分析' })
  getAfterSaleAnalysis(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getAfterSaleAnalysis(req.user.tenantId, days ? parseInt(days) : undefined);
  }

  @Get('platform-comparison')
  @ApiOperation({ summary: '平台对比' })
  getPlatformComparison(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getPlatformComparison(req.user.tenantId, days ? parseInt(days) : undefined);
  }

  @Get('agent-performance')
  @ApiOperation({ summary: '客服绩效' })
  getAgentPerformance(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getAgentPerformance(req.user.tenantId, days ? parseInt(days) : undefined);
  }

  @Get('ai-accuracy')
  @ApiOperation({ summary: 'AI回复准确率' })
  getAiAccuracy(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getAiAccuracy(req.user.tenantId, days ? parseInt(days) : undefined);
  }

  @Get('trend')
  @ApiOperation({ summary: '趋势数据' })
  getTrend(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getTrend(req.user.tenantId, days ? parseInt(days) : undefined);
  }
}
