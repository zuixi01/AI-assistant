import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { XiaohongshuService } from './xiaohongshu.service';
import { XhsWebhookGuard } from './xhs-webhook.guard';

// ─── Webhook Endpoints (no JWT — called by XHS servers) ─────────

@ApiTags('webhooks/xiaohongshu')
@Controller('webhooks/xiaohongshu')
@UseGuards(XhsWebhookGuard)
export class XiaohongshuWebhookController {
  constructor(private readonly xhsService: XiaohongshuService) {}

  @Post('im/send')
  async handleImSend(@Body() body: any) {
    return this.xhsService.handleMessage(body);
  }

  @Post('im/bind_account')
  async handleBindAccount(@Body() body: any) {
    return this.xhsService.handleBindAccount(body);
  }

  @Post('im/unbind_account')
  async handleUnbindAccount(@Body() body: any) {
    return this.xhsService.handleUnbindAccount(body);
  }

  @Post('auth/bind_user/event')
  async handleKosBindEvent(@Body() body: any) {
    return this.xhsService.handleKosBindEvent(body);
  }

  @Post('intent/comment')
  async handleIntentComment(@Body() body: any) {
    return this.xhsService.handleIntentComment(body);
  }

  @Post('third/data')
  async handleLeadData(@Body() body: any) {
    return this.xhsService.handleLeadData(body);
  }
}

// ─── Admin Endpoints (JWT protected) ────────────────────────────

@ApiTags('open/im')
@Controller('open/im')
@UseGuards(XhsWebhookGuard)
export class XiaohongshuOpenImController {
  constructor(private readonly xhsService: XiaohongshuService) {}

  @Post('send')
  async handleImSend(@Body() body: any) {
    return this.xhsService.handleMessage(body);
  }

  @Post('third/bind_account')
  async handleBindAccount(@Body() body: any) {
    return this.xhsService.handleBindAccount(body);
  }

  @Post('third/unbind_account')
  async handleUnbindAccount(@Body() body: any) {
    return this.xhsService.handleUnbindAccount(body);
  }

  @Post('auth/bind_user/event')
  async handleKosBindEvent(@Body() body: any) {
    return this.xhsService.handleKosBindEvent(body);
  }

  @Post('intent/comment')
  async handleIntentComment(@Body() body: any) {
    return this.xhsService.handleIntentComment(body);
  }

  @Post('third/data')
  async handleLeadData(@Body() body: any) {
    return this.xhsService.handleLeadData(body);
  }
}

@ApiTags('admin/integrations/xiaohongshu')
@Controller('admin/integrations/xiaohongshu')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class XiaohongshuAdminController {
  constructor(private readonly xhsService: XiaohongshuService) {}

  @Get('accounts')
  async getAccounts(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.xhsService.getAccounts(tenantId);
  }

  @Get('messages')
  async getMessages(@Req() req: any, @Query('conversationId') conversationId?: string) {
    const tenantId = req.user.tenantId;
    return this.xhsService.getMessages(tenantId, conversationId);
  }

  @Post('send')
  async sendReply(@Req() req: any, @Body() body: { accountId: string; toUserId: string; content: string }) {
    const tenantId = req.user.tenantId;
    return this.xhsService.sendManualReply(tenantId, body.accountId, body.toUserId, body.content);
  }

  @Post('accounts')
  async createAccount(@Req() req: any, @Body() body: {
    userId: string;
    appId: string;
    accountCode: string;
    nickName?: string;
    accountType?: string;
    accessToken?: string;
  }) {
    const tenantId = req.user.tenantId;
    return this.xhsService.createAccount(tenantId, body);
  }

  @Patch('accounts/:id')
  async updateAccount(@Req() req: any, @Param('id') id: string, @Body() body: {
    nickName?: string;
    accountType?: string;
    accessToken?: string;
    status?: string;
  }) {
    const tenantId = req.user.tenantId;
    return this.xhsService.updateAccount(id, tenantId, body);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.xhsService.deleteAccount(id, tenantId);
  }

  // ─── Juguang account binding QR code flow ───────────────────

  @Get('oauth/authorize')
  async getAuthUrl(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.xhsService.generateAuthUrl(tenantId);
  }
}

// ─── OAuth Callback (no JWT — called by XHS redirect) ────────

@Controller('admin/integrations/xiaohongshu/oauth')
export class XiaohongshuOAuthController {
  constructor(private readonly xhsService: XiaohongshuService) {}

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendBase = '/admin/settings/xiaohongshu';
    if (!code || !state) {
      return res.redirect(`${frontendBase}?oauth=error&msg=missing_params`);
    }
    const result = await this.xhsService.handleOAuthCallback(code, state);
    if (result.success) {
      return res.redirect(`${frontendBase}?oauth=success&accountId=${result.accountId}`);
    }
    return res.redirect(`${frontendBase}?oauth=error&msg=${encodeURIComponent(result.error || 'unknown')}`);
  }
}
