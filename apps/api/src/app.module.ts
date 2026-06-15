import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { AdminsModule } from './admins/admins.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeadsModule } from './leads/leads.module';
import { AfterSalesModule } from './after-sales/after-sales.module';
import { UnknownQuestionsModule } from './unknown-questions/unknown-questions.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { CouponsModule } from './coupons/coupons.module';
import { QuickReplyModule } from './quick-reply/quick-reply.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './common/prisma/prisma.module';

function redisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10_000),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 1_000, 5_000),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    BullModule.forRoot({ connection: redisConnection() }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          const tenantId = req.headers['x-tenant-id'] || req.query?.tenantId;
          if (tenantId) {
            cls.set('tenantId', tenantId);
          }
          if (req.user?.id) {
            cls.set('userId', req.user.id);
          }
        },
      },
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    AdminsModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    AiModule,
    KnowledgeModule,
    LeadsModule,
    AfterSalesModule,
    UnknownQuestionsModule,
    WebhooksModule,
    AnalyticsModule,
    NotificationsModule,
    ChatModule,
    IntegrationsModule,
    CouponsModule,
    QuickReplyModule,
    WorkspaceModule,
    ProductsModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
