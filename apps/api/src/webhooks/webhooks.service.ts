import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async processDoudianEvent(payload: any, signature?: string) {
    // Verify signature
    const secret = this.config.get('WEBHOOK_SECRET');
    if (secret && signature) {
      const crypto = await import('crypto');
      const expectedSig = crypto.createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (signature !== expectedSig) {
        this.logger.warn('Webhook signature verification failed');
        return { success: false, error: 'Invalid signature' };
      }
    }

    const externalEventId = payload.event_id || payload.msg_id;
    const eventType = payload.event_type || payload.type;

    // Idempotency check
    if (externalEventId) {
      const existing = await this.prisma.webhookEvent.findFirst({
        where: { platform: 'doudian', externalEventId },
      });
      if (existing?.processed) {
        return { success: true, message: 'Already processed' };
      }
    }

    // Store event
    const event = await this.prisma.webhookEvent.create({
      data: {
        platform: 'doudian',
        eventType,
        externalEventId,
        payload,
      },
    });

    try {
      // Process based on event type
      await this.handleEvent(eventType, payload);

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { success: true, eventId: event.id };
    } catch (error: any) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { retryCount: { increment: 1 }, errorMessage: error.message },
      });
      this.logger.error(`Webhook processing failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async handleEvent(eventType: string, payload: any) {
    this.logger.log(`Processing webhook event: ${eventType}`);
    // Event handlers will be implemented in Doudian integration module
    switch (eventType) {
      case 'order_paid':
      case 'order_shipped':
      case 'order_completed':
      case 'order_cancelled':
        this.logger.log(`Order event: ${eventType}`);
        break;
      case 'aftersale_created':
      case 'aftersale_completed':
        this.logger.log(`Aftersale event: ${eventType}`);
        break;
      default:
        this.logger.log(`Unknown event type: ${eventType}`);
    }
  }
}
