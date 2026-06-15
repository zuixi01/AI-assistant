import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { XiaohongshuService } from '../../apps/api/src/integrations/xiaohongshu/xiaohongshu.service';
import { XhsCrypto } from '../../apps/api/src/integrations/xiaohongshu/xhs-crypto';

function createCrypto() {
  return new XhsCrypto({
    get: vi.fn((key: string, fallback?: string) => {
      if (key === 'XHS_CRYPTO_KEY') return '00112233445566778899aabbccddeeff';
      return fallback;
    }),
  } as any);
}

function createService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'demo-shop' }),
    },
    xhsAccount: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'xhs-account-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    xhsMessage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: { upsert: vi.fn() },
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    ...prismaOverrides,
  };
  const crypto = createCrypto();
  const apiClient = {
    getAuthUrl: vi.fn((redirectUri: string, state: string) =>
      `https://adapi.xiaohongshu.com/oauth2/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    ),
    getBindingUrl: vi.fn((token: string) =>
      `https://ad.xiaohongshu.com/api/leona/three/im/account/add?appId=46&token=${encodeURIComponent(token)}`,
    ),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
  };
  const config = {
    get: vi.fn((key: string, fallback?: string) => {
      if (key === 'XHS_APP_ID') return '46';
      if (key === 'XHS_ACCESS_TOKEN') return 'default-token';
      return fallback;
    }),
  };
  const service = new XiaohongshuService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    apiClient as any,
    crypto,
    config as any,
  );
  return { service, prisma, crypto, apiClient };
}

describe('xiaohongshu third-party binding flow', () => {
  it('generates the documented Juguang account binding URL instead of an OAuth authorize URL', async () => {
    const { service, crypto } = createService();

    const result = await (service as any).generateAuthUrl('tenant-1');
    const url = new URL(result.url);

    expect(url.origin + url.pathname).toBe('https://ad.xiaohongshu.com/api/leona/three/im/account/add');
    expect(url.searchParams.get('appId')).toBe('46');
    expect(result.url).not.toContain('/oauth2/authorize');

    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(JSON.parse(crypto.decrypt(token!))).toMatchObject({
      tenant_id: 'tenant-1',
      account_code: 'demo-shop',
    });
  });

  it('creates the first tenant account from the encrypted token returned by the bind callback', async () => {
    const { service, prisma, crypto } = createService();
    const bindToken = crypto.encrypt(JSON.stringify({ tenant_id: 'tenant-1', account_code: 'demo-shop' }));
    const content = crypto.encrypt(JSON.stringify({
      user_id: 'xhs-user-1',
      nick_name: 'Shop account',
      app_id: 46,
      token: bindToken,
    }));

    const result = await service.handleBindAccount({ content });

    expect(result).toEqual({ success: true });
    expect(prisma.xhsAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'xhs-user-1' } },
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'xhs-user-1',
        appId: '46',
        accountCode: 'demo-shop',
        nickName: 'Shop account',
        status: 'active',
      }),
    }));
  });

  it('keeps the documented incoming Xiaohongshu open/im paths routable', () => {
    const source = readFileSync('apps/api/src/integrations/xiaohongshu/xiaohongshu.controller.ts', 'utf8');

    expect(source).toContain("@Controller('open/im')");
    expect(source).toContain("@Post('send')");
    expect(source).toContain("@Post('third/bind_account')");
    expect(source).toContain("@Post('third/unbind_account')");
    expect(source).toContain("@Post('auth/bind_user/event')");
  });

  it('shows the documented message callback URL in the admin page', () => {
    const source = readFileSync('apps/web/src/app/admin/settings/xiaohongshu/page.tsx', 'utf8');

    expect(source).toContain('/api/open/im/send');
    expect(source).not.toContain('/webhooks/xiaohongshu/im/send');
  });

  it('encrypts outgoing text replies as the JSON text payload Xiaohongshu expects', async () => {
    const { service, crypto, apiClient } = createService({
      xhsAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'account-1',
          tenantId: 'tenant-1',
          userId: 'merchant-user-1',
          accountCode: 'demo-shop',
          accessToken: null,
          status: 'active',
        }),
      },
    });

    await service.sendManualReply('tenant-1', 'account-1', 'customer-user-1', 'hello');

    const [{ contentEncrypted }] = apiClient.sendMessage.mock.calls[0];
    expect(JSON.parse(crypto.decrypt(contentEncrypted))).toEqual({ text: 'hello' });
  });
});
