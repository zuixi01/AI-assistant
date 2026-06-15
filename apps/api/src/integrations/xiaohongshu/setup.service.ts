import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { XhsApiClient } from './xhs-api.client';
import { XhsCrypto } from './xhs-crypto';

export interface SetupStatus {
  cryptoKey: boolean;
  appId: boolean;
  appSecret: boolean;
  accessToken: boolean;
  webhookVerify: boolean;
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private tempCryptoKey: string | null = null;
  private tempAppId: string | null = null;
  private tempAppSecret: string | null = null;
  private tempAccessToken: string | null = null;

  constructor(
    private configService: ConfigService,
    private xhsApiClient: XhsApiClient,
    private xhsCrypto: XhsCrypto,
  ) {}

  async getSetupStatus(): Promise<SetupStatus> {
    return {
      cryptoKey: !!this.configService.get<string>('XHS_CRYPTO_KEY'),
      appId: !!this.configService.get<string>('XHS_APP_ID'),
      appSecret: !!this.configService.get<string>('XHS_APP_SECRET'),
      accessToken: !!this.configService.get<string>('XHS_ACCESS_TOKEN'),
      webhookVerify: this.configService.get<string>('XHS_WEBHOOK_VERIFY') === 'true',
    };
  }

  async generateCryptoKey(): Promise<{ key: string }> {
    const key = randomBytes(16).toString('hex');
    this.tempCryptoKey = key;
    this.logger.log('Generated new XHS crypto key');
    return { key };
  }

  async saveCredentials(appId: string, appSecret: string): Promise<{ success: boolean }> {
    if (!appId) {
      throw new BadRequestException('APP_ID is required');
    }

    this.tempAppId = appId;
    this.tempAppSecret = appSecret;
    this.logger.log(`Saved credentials for appId: ${appId}`);
    return { success: true };
  }

  async generateOAuthUrl(tenantId: string): Promise<{ url: string; state: string }> {
    const appId = this.tempAppId || this.configService.get<string>('XHS_APP_ID');
    if (!appId) {
      throw new BadRequestException('APP_ID not configured. Please save credentials first.');
    }

    const state = `${tenantId}:${Date.now()}`;
    const redirectUri = `${this.configService.get<string>('APP_URL', 'http://localhost:4000')}/api/admin/setup/xiaohongshu/oauth/callback`;
    const url = `https://adapi.xiaohongshu.com/oauth2/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=im`;

    this.logger.log(`Generated OAuth URL for tenant: ${tenantId}`);
    return { url, state };
  }

  async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; error?: string }> {
    try {
      const appId = this.tempAppId || this.configService.get<string>('XHS_APP_ID');
      const appSecret = this.tempAppSecret || this.configService.get<string>('XHS_APP_SECRET');

      if (!appId || !appSecret) {
        return { success: false, error: 'APP_ID and APP_SECRET are required' };
      }

      // Exchange code for access token
      const response = await fetch('https://adapi.xiaohongshu.com/oauth2/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.error(`OAuth token exchange failed: ${response.status} ${text}`);
        return { success: false, error: `OAuth error: ${response.status}` };
      }

      const data = await response.json() as any;
      if (data.code !== 0 && data.code !== 200) {
        this.logger.error(`OAuth business error: ${JSON.stringify(data)}`);
        return { success: false, error: data.msg || data.message || 'OAuth token exchange failed' };
      }

      this.tempAccessToken = data.data?.access_token || data.access_token;
      this.logger.log('OAuth callback successful, access token received');
      return { success: true };
    } catch (e: any) {
      this.logger.error(`OAuth callback failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  async completeSetup(): Promise<{ success: boolean; message: string }> {
    try {
      const cryptoKey = this.tempCryptoKey || this.configService.get<string>('XHS_CRYPTO_KEY');
      const appId = this.tempAppId || this.configService.get<string>('XHS_APP_ID');
      const appSecret = this.tempAppSecret || this.configService.get<string>('XHS_APP_SECRET');
      const accessToken = this.tempAccessToken || this.configService.get<string>('XHS_ACCESS_TOKEN');

      if (!cryptoKey || !appId) {
        return { success: false, message: 'Missing required configuration. Please complete all steps.' };
      }

      // Save to .env file
      await this.saveConfigToEnv({
        cryptoKey,
        appId,
        appSecret: appSecret || '',
        accessToken: accessToken || '',
      });

      // Clear temporary values
      this.tempCryptoKey = null;
      this.tempAppId = null;
      this.tempAppSecret = null;
      this.tempAccessToken = null;

      this.logger.log('Setup completed successfully');
      return { success: true, message: 'Configuration saved successfully. Please restart the API server.' };
    } catch (e: any) {
      this.logger.error(`Failed to complete setup: ${e.message}`);
      return { success: false, message: `Failed to save configuration: ${e.message}` };
    }
  }

  private async saveConfigToEnv(config: {
    cryptoKey: string;
    appId: string;
    appSecret: string;
    accessToken: string;
  }): Promise<void> {
    const envPath = path.join(process.cwd(), '.env');

    // Read existing .env file
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      // File doesn't exist, create new content
      envContent = '# Xiaohongshu (小红书三方客服)\n';
    }

    // Update or add configuration values
    const updates: Record<string, string> = {
      'XHS_CRYPTO_KEY': config.cryptoKey,
      'XHS_APP_ID': config.appId,
      'XHS_APP_SECRET': config.appSecret,
      'XHS_ACCESS_TOKEN': config.accessToken,
      'XHS_WEBHOOK_VERIFY': 'false',
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const line = `${key}=${value}`;

      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, line);
      } else {
        // Add to Xiaohongshu section or at the end
        if (envContent.includes('# Xiaohongshu')) {
          envContent = envContent.replace(
            /(# Xiaohongshu[^\n]*\n)/,
            `$1${line}\n`
          );
        } else {
          envContent += `\n# Xiaohongshu (小红书三方客服)\n${line}\n`;
        }
      }
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent, 'utf-8');
    this.logger.log(`Configuration saved to ${envPath}`);
  }
}
