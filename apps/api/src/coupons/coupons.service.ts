import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CouponConfig {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  type: 'fixed' | 'percent' | 'free_shipping';
  value: number; // 分 for fixed, 折 for percent (e.g., 80 = 8折)
  minAmount?: number; // 最低消费金额（分）
  maxDiscount?: number; // 最大优惠金额（分）
  productId?: string; // 关联商品
  startTime?: Date;
  endTime?: Date;
  usageLimit?: number;
  usedCount?: number;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get available coupons for a tenant
   */
  async getAvailableCoupons(tenantId: string, productId?: string): Promise<CouponConfig[]> {
    // In production, query from coupons table
    // For now, return mock coupons
    const mockCoupons: CouponConfig[] = [
      {
        tenantId,
        code: 'WELCOME10',
        name: '新用户专享券',
        type: 'fixed',
        value: 1000, // 10元
        minAmount: 5000, // 满50可用
      },
      {
        tenantId,
        code: 'FRUIT88',
        name: '水果88折券',
        type: 'percent',
        value: 88, // 8.8折
        productId,
        minAmount: 3000,
      },
    ];

    return mockCoupons;
  }

  /**
   * Validate and apply coupon
   */
  async applyCoupon(tenantId: string, code: string, orderAmount: number, productId?: string): Promise<{
    valid: boolean;
    discount: number;
    message: string;
  }> {
    const coupons = await this.getAvailableCoupons(tenantId, productId);
    const coupon = coupons.find((c) => c.code === code);

    if (!coupon) {
      return { valid: false, discount: 0, message: '优惠券不存在' };
    }

    if (coupon.minAmount && orderAmount < coupon.minAmount) {
      return { valid: false, discount: 0, message: `未达到最低消费金额${coupon.minAmount / 100}元` };
    }

    let discount = 0;
    switch (coupon.type) {
      case 'fixed':
        discount = coupon.value;
        break;
      case 'percent':
        discount = Math.floor(orderAmount * (100 - coupon.value) / 100);
        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
        break;
      case 'free_shipping':
        discount = 0; // Shipping fee discount handled separately
        break;
    }

    return {
      valid: true,
      discount,
      message: `优惠${discount / 100}元`,
    };
  }

  /**
   * Check if coupon should be recommended based on context
   */
  shouldRecommendCoupon(context: {
    isPriceInquiry?: boolean;
    isHighIntent?: boolean;
    cartAmount?: number;
  }): boolean {
    return context.isPriceInquiry || context.isHighIntent || (context.cartAmount ? context.cartAmount > 5000 : false);
  }
}
