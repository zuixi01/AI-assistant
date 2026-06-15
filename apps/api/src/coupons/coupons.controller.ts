import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Get('available')
  @ApiOperation({ summary: '获取可用优惠券' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAvailable(@Request() req, @Query('productId') productId?: string) {
    return this.couponsService.getAvailableCoupons(req.user.tenantId, productId);
  }

  @Post('apply')
  @ApiOperation({ summary: '应用优惠券' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async applyCoupon(
    @Request() req,
    @Body() body: { code: string; orderAmount: number; productId?: string },
  ) {
    return this.couponsService.applyCoupon(req.user.tenantId, body.code, body.orderAmount, body.productId);
  }

  @Post('recommend')
  @ApiOperation({ summary: '判断是否推荐优惠券' })
  async shouldRecommend(
    @Body() body: { isPriceInquiry?: boolean; isHighIntent?: boolean; cartAmount?: number },
  ) {
    const shouldRecommend = this.couponsService.shouldRecommendCoupon(body);
    return { shouldRecommend };
  }
}
