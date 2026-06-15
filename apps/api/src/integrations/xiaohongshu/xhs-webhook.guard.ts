import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

/**
 * Verifies XHS webhook signature.
 * XHS sends `X-Xhs-Signature` header = HMAC-SHA256(rawBody, cryptoKey).
 * If XHS_WEBHOOK_VERIFY is not "true", this guard passes all requests (dev mode).
 */
@Injectable()
export class XhsWebhookGuard implements CanActivate {
  private readonly logger = new Logger(XhsWebhookGuard.name);
  private readonly enabled: boolean;
  private readonly cryptoKey: string;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<string>('XHS_WEBHOOK_VERIFY', 'false') === 'true';
    this.cryptoKey = this.configService.get<string>('XHS_CRYPTO_KEY', '');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;

    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-xhs-signature'] || req.headers['x-signature'];
    if (!signature) {
      this.logger.warn('XHS webhook: missing signature header');
      return false;
    }

    if (!this.cryptoKey) {
      this.logger.warn('XHS webhook: XHS_CRYPTO_KEY not configured, skipping verification');
      return true;
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = createHmac('sha256', this.cryptoKey).update(rawBody).digest('hex');

    if (signature !== expected) {
      this.logger.warn('XHS webhook: signature mismatch');
      return false;
    }

    return true;
  }
}
