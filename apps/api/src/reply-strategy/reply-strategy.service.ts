import { Injectable, Logger } from '@nestjs/common';

export interface ReplyDelayConfig {
  minDelayMs: number;
  maxDelayMs: number;
  humanizeTyping: boolean;
  typingDurationMs: number;
}

const DEFAULT_CONFIG: ReplyDelayConfig = {
  minDelayMs: 2000,
  maxDelayMs: 6000,
  humanizeTyping: true,
  typingDurationMs: 1500,
};

const PLATFORM_CONFIGS: Record<string, Partial<ReplyDelayConfig>> = {
  wechat: { minDelayMs: 3000, maxDelayMs: 8000 },
  taobao: { minDelayMs: 2000, maxDelayMs: 5000 },
  pdd: { minDelayMs: 2000, maxDelayMs: 5000 },
  douyin_enterprise: { minDelayMs: 3000, maxDelayMs: 7000 },
  xiaohongshu: { minDelayMs: 2000, maxDelayMs: 6000 },
  juguang: { minDelayMs: 2000, maxDelayMs: 6000 },
};

@Injectable()
export class ReplyStrategyService {
  private readonly logger = new Logger(ReplyStrategyService.name);

  getConfig(channel: string): ReplyDelayConfig {
    const platformConfig = PLATFORM_CONFIGS[channel] || {};
    return { ...DEFAULT_CONFIG, ...platformConfig };
  }

  /**
   * Calculate a random delay to simulate human reply timing.
   * Adjusts based on message length (longer messages = longer delay).
   */
  calculateDelay(channel: string, replyContent: string): number {
    const config = this.getConfig(channel);
    const baseDelay = this.randomBetween(config.minDelayMs, config.maxDelayMs);

    // Adjust for message length: +50ms per 50 chars
    const lengthAdjustment = Math.floor(replyContent.length / 50) * 50;
    const adjustedDelay = baseDelay + Math.min(lengthAdjustment, 3000);

    this.logger.debug('Reply delay calculated: ' + adjustedDelay + 'ms for channel ' + channel);
    return adjustedDelay;
  }

  /**
   * Calculate typing indicator duration (if platform supports it).
   */
  calculateTypingDuration(channel: string, replyContent: string): number {
    const config = this.getConfig(channel);
    if (!config.humanizeTyping) return 0;

    // Typing speed: ~200ms per 10 chars, capped at 5 seconds
    const typingMs = Math.floor(replyContent.length / 10) * 200;
    return Math.min(typingMs, 5000);
  }

  /**
   * Should this message get an auto-reply?
   * Checks platform config and rate limiting.
   */
  shouldAutoReply(channel: string, messageCount: number): boolean {
    // Rate limit: max 10 auto-replies per conversation
    if (messageCount >= 10) {
      this.logger.debug('Auto-reply rate limit hit for channel ' + channel);
      return false;
    }
    return true;
  }

  /**
   * Wait for the calculated delay (used by platform router).
   */
  async wait(channel: string, replyContent: string): Promise<void> {
    const delay = this.calculateDelay(channel, replyContent);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
