import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

interface NotificationPayload {
  title: string;
  content: string;
  type: 'new_lead' | 'high_intent' | 'order_alert' | 'aftersale_alert';
  data?: any;
}

/** 租户「系统设置」里保存的 Webhook（与 .env 二选一：租户优先） */
interface TenantNotificationConfig {
  wecomWebhook?: string;
  feishuWebhook?: string;
  dingtalkWebhook?: string;
}

export type NotificationChannel = 'wecom' | 'feishu' | 'dingtalk';

export interface NotificationChannelResult {
  channel: NotificationChannel;
  status: 'skipped' | 'ok' | 'error';
  message?: string;
}

export interface NotificationSendResult {
  channels: NotificationChannelResult[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * 发送通知：优先使用租户 config 中的 Webhook，否则回退到环境变量。
   */
  async send(
    payload: NotificationPayload,
    options?: { tenantId?: string },
  ): Promise<NotificationSendResult> {
    const urls = await this.resolveWebhookUrls(options?.tenantId);

    const settled = await Promise.allSettled([
      this.sendToWeCom(payload, urls.wecom),
      this.sendToFeishu(payload, urls.feishu),
      this.sendToDingtalk(payload, urls.dingtalk),
    ]);

    const names: NotificationChannel[] = ['wecom', 'feishu', 'dingtalk'];
    const channels: NotificationChannelResult[] = settled.map((r, i) => {
      if (r.status === 'fulfilled') {
        return { channel: names[i], ...r.value };
      }
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      return { channel: names[i], status: 'error' as const, message: msg };
    });

    for (const c of channels) {
      if (c.status === 'error' && c.message) {
        this.logger.error(`Notification ${c.channel}: ${c.message}`);
      }
    }

    return { channels };
  }

  private async resolveWebhookUrls(tenantId?: string): Promise<{
    wecom?: string;
    feishu?: string;
    dingtalk?: string;
  }> {
    const fromEnv = {
      wecom: this.config.get<string>('WE_COM_WEBHOOK_URL')?.trim() || undefined,
      feishu: this.config.get<string>('FEISHU_WEBHOOK_URL')?.trim() || undefined,
      dingtalk: this.config.get<string>('DINGTALK_WEBHOOK_URL')?.trim() || undefined,
    };

    const tid = tenantId?.trim();
    if (!tid) return fromEnv;

    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(tid)) {
      this.logger.warn(`resolveWebhookUrls: skip tenant lookup, invalid tenantId shape`);
      return fromEnv;
    }

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tid },
        select: { config: true },
      });
      const raw = tenant?.config;
      const cfg: TenantNotificationConfig =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as TenantNotificationConfig) : {};

      return {
        wecom: cfg.wecomWebhook?.trim() || fromEnv.wecom,
        feishu: cfg.feishuWebhook?.trim() || fromEnv.feishu,
        dingtalk: cfg.dingtalkWebhook?.trim() || fromEnv.dingtalk,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`resolveWebhookUrls failed: ${msg}`);
      return fromEnv;
    }
  }

  private async sendToWeCom(
    payload: NotificationPayload,
    webhookUrl?: string,
  ): Promise<Pick<NotificationChannelResult, 'status' | 'message'>> {
    if (!webhookUrl) return { status: 'skipped', message: '未配置企业微信 Webhook' };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: `**${payload.title}**\n\n${payload.content}` },
        }),
      });
      const text = await res.text();
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      return { status: 'ok' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 'error', message: msg };
    }
  }

  /**
   * 飞书自定义机器人：使用 text 类型，兼容性优于部分环境下的 interactive。
   */
  private async sendToFeishu(
    payload: NotificationPayload,
    webhookUrl?: string,
  ): Promise<Pick<NotificationChannelResult, 'status' | 'message'>> {
    if (!webhookUrl) return { status: 'skipped', message: '未配置飞书 Webhook（请在系统设置填写或配置 FEISHU_WEBHOOK_URL）' };

    try {
      const text = `${payload.title}\n\n${payload.content}`;
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text },
        }),
      });
      const body = await res.text();
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
      if (!body.trim()) return { status: 'ok' };
      try {
        const json = JSON.parse(body) as { code?: number; msg?: string; StatusCode?: number };
        if (json.code !== undefined && json.code !== 0) {
          return { status: 'error', message: json.msg || `code=${json.code}` };
        }
        if (json.StatusCode !== undefined && json.StatusCode !== 0) {
          return { status: 'error', message: json.msg || `StatusCode=${json.StatusCode}` };
        }
      } catch {
        /* 部分网关返回非 JSON 仍表示成功 */
      }
      return { status: 'ok' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 'error', message: msg };
    }
  }

  private async sendToDingtalk(
    payload: NotificationPayload,
    webhookUrl?: string,
  ): Promise<Pick<NotificationChannelResult, 'status' | 'message'>> {
    if (!webhookUrl) return { status: 'skipped', message: '未配置钉钉 Webhook' };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { title: payload.title, text: `### ${payload.title}\n\n${payload.content}` },
        }),
      });
      const text = await res.text();
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      return { status: 'ok' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 'error', message: msg };
    }
  }

  async notifyNewLead(lead: {
    tenantId?: string;
    name?: string;
    phone?: string;
    source?: string;
  }) {
    await this.send(
      {
        title: '新线索提醒',
        content: `来源: ${lead.source || '未知'}\n姓名: ${lead.name || '未提供'}\n手机: ${lead.phone || '未提供'}`,
        type: 'new_lead',
        data: lead,
      },
      { tenantId: lead.tenantId },
    );
  }

  async notifyHighIntent(lead: {
    tenantId?: string;
    name?: string;
    phone?: string;
    intentScore?: number;
  }) {
    await this.send(
      {
        title: '高意向客户提醒',
        content: `姓名: ${lead.name || '未提供'}\n意向评分: ${lead.intentScore || 0}\n手机: ${lead.phone || '未提供'}`,
        type: 'high_intent',
        data: lead,
      },
      { tenantId: lead.tenantId },
    );
  }
}
