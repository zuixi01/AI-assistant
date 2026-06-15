import { Controller, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MiniappService } from './miniapp.service';

@ApiTags('miniapp')
@Controller('miniapp')
export class MiniappController {
  constructor(private miniappService: MiniappService) {}

  @Post('douyin/login')
  @ApiOperation({ summary: '抖音小程序登录' })
  douyinLogin(@Body() body: { code: string; tenantId: string }) {
    return this.miniappService.douyinLogin(body.code, body.tenantId);
  }

  @Post('wechat/login')
  @ApiOperation({ summary: '微信小程序登录' })
  wechatLogin(@Body() body: { code: string; tenantId: string }) {
    return this.miniappService.wechatLogin(body.code, body.tenantId);
  }
}
