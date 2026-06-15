import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SetupService } from './setup.service';

@ApiTags('admin/setup/xiaohongshu')
@Controller('admin/setup/xiaohongshu')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  async getStatus() {
    return this.setupService.getSetupStatus();
  }

  @Post('generate-key')
  async generateKey() {
    return this.setupService.generateCryptoKey();
  }

  @Post('save-credentials')
  async saveCredentials(@Body() body: { appId: string; appSecret: string }) {
    return this.setupService.saveCredentials(body.appId, body.appSecret);
  }

  @Get('oauth/authorize')
  async getAuthUrl(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.setupService.generateOAuthUrl(tenantId);
  }

  @Get('oauth/callback')
  async handleCallback(@Req() req: any, @Res() res: Response) {
    const { code, state } = req.query;
    const frontendBase = '/admin/settings/xiaohongshu/setup';

    if (!code || !state) {
      return res.redirect(`${frontendBase}?step=3&oauth=error&msg=missing_params`);
    }

    const result = await this.setupService.handleOAuthCallback(code as string, state as string);

    if (result.success) {
      return res.redirect(`${frontendBase}?step=4&oauth=success`);
    }

    return res.redirect(`${frontendBase}?step=3&oauth=error&msg=${encodeURIComponent(result.error || 'unknown')}`);
  }

  @Post('complete')
  async completeSetup() {
    return this.setupService.completeSetup();
  }
}
