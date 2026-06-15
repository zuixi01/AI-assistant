import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { MiniappModule } from './miniapp/miniapp.module';
import { XiaohongshuModule } from './xiaohongshu/xiaohongshu.module';
import { ChatGptOnCsModule } from './chatgpt-on-cs/chatgpt-on-cs.module';
import { JuguangModule } from './juguang/juguang.module';
import { DoudianModule } from './doudian/doudian.module';

@Module({
  imports: [MiniappModule, XiaohongshuModule, ChatGptOnCsModule, JuguangModule, DoudianModule],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
