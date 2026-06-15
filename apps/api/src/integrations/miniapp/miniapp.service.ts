import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../../users/users.service';

export interface MiniappLoginResult {
  openid: string;
  unionid?: string;
  sessionKey?: string;
  userId: string;
}

@Injectable()
export class MiniappService {
  private readonly logger = new Logger(MiniappService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async douyinLogin(code: string, tenantId: string): Promise<MiniappLoginResult> {
    const appId = this.config.get('DOUYIN_MINIAPP_APP_ID');
    const appSecret = this.config.get('DOUYIN_MINIAPP_APP_SECRET');

    if (!appId || !appSecret) {
      // Mock mode
      return this.mockLogin('douyin', code, tenantId);
    }

    const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: appId, secret: appSecret, code }),
    });

    const data = await response.json();
    if (data.err_no !== 0) throw new Error(`Douyin login error: ${data.err_tips}`);

    return this.findOrCreateUser(tenantId, {
      douyinOpenid: data.openid,
      douyinUnionid: data.unionid,
      source: 'douyin_miniapp',
    });
  }

  async wechatLogin(code: string, tenantId: string): Promise<MiniappLoginResult> {
    const appId = this.config.get('WECHAT_MINIAPP_APP_ID');
    const appSecret = this.config.get('WECHAT_MINIAPP_APP_SECRET');

    if (!appId || !appSecret) {
      return this.mockLogin('wechat', code, tenantId);
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) throw new Error(`WeChat login error: ${data.errmsg}`);

    return this.findOrCreateUser(tenantId, {
      wechatOpenid: data.openid,
      source: 'wechat_miniapp',
    });
  }

  private async mockLogin(platform: string, code: string, tenantId: string): Promise<MiniappLoginResult> {
    const mockOpenid = `mock_${platform}_${code}`;
    this.logger.log(`Mock ${platform} login: ${mockOpenid}`);

    return this.findOrCreateUser(tenantId, {
      [platform === 'douyin' ? 'douyinOpenid' : 'wechatOpenid']: mockOpenid,
      source: `${platform}_miniapp`,
      nickname: `Mock User ${code}`,
    });
  }

  private async findOrCreateUser(tenantId: string, data: any): Promise<MiniappLoginResult> {
    let user: any = null;

    if (data.douyinOpenid) {
      user = await this.usersService.findByDouyinOpenid(data.douyinOpenid);
    } else if (data.wechatOpenid) {
      user = await this.usersService.findByWechatOpenid(data.wechatOpenid);
    }

    if (!user) {
      user = await this.usersService.create(tenantId, data);
    }

    return {
      openid: data.douyinOpenid || data.wechatOpenid,
      unionid: data.douyinUnionid,
      userId: user.id,
    };
  }
}
