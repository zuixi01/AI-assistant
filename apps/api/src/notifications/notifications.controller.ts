import { BadRequestException, Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestNotificationDto } from './dto/test-notification.dto';

@ApiTags('admin/notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('test')
  @ApiOperation({ summary: '测试通知（按租户系统设置 + 环境变量发送各渠道）' })
  async test(@Request() req: { user: { tenantId?: string; id?: string } }, @Body() body: TestNotificationDto) {
    const tenantId = req.user?.tenantId?.trim();
    if (!tenantId) {
      throw new BadRequestException('当前账号未绑定租户，请重新登录后再试');
    }

    const result = await this.notificationsService.send(
      {
        title: body.title?.trim() || '连接测试',
        content: body.content?.trim() || 'AI 客服助手：这是一条通知通道测试消息。',
        type: 'new_lead',
      },
      { tenantId },
    );
    const feishu = result.channels.find((c) => c.channel === 'feishu');
    return {
      ok: feishu?.status === 'ok',
      summary: result.channels.map((c) => `${c.channel}: ${c.status}${c.message ? ` (${c.message})` : ''}`).join('；'),
      channels: result.channels,
    };
  }
}
