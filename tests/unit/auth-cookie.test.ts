import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../apps/api/src/auth/auth.controller';
import {
  ADMIN_AUTH_COOKIE,
  buildAdminCookieOptions,
  extractJwtFromRequest,
  getRequiredJwtSecret,
} from '../../apps/api/src/auth/auth.config';

describe('admin web cookie auth', () => {
  it('requires a real JWT secret for production auth', () => {
    const config = { get: vi.fn().mockReturnValue('change_me_in_production') };

    expect(() => getRequiredJwtSecret(config as any)).toThrow('JWT_SECRET');
  });

  it('prefers the httpOnly admin cookie over a bearer token', () => {
    const token = extractJwtFromRequest({
      cookies: { [ADMIN_AUTH_COOKIE]: 'cookie-token' },
      headers: { authorization: 'Bearer bearer-token' },
    } as any);

    expect(token).toBe('cookie-token');
  });

  it('builds production-safe admin cookie options', () => {
    expect(buildAdminCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('sets the admin token as an httpOnly cookie on login and does not expose it in the response body', async () => {
    const authService = {
      login: vi.fn().mockResolvedValue({
        accessToken: 'signed-token',
        admin: { id: 'admin-1', email: 'ops@lingnanfresh.cn', tenantId: 'tenant-1' },
      }),
    };
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const controller = new AuthController(authService as any);

    const body = await controller.login({ email: 'ops@lingnanfresh.cn', password: 'FreshOps2026!' }, res as any);

    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_AUTH_COOKIE,
      'signed-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(body).toEqual({ admin: { id: 'admin-1', email: 'ops@lingnanfresh.cn', tenantId: 'tenant-1' } });
  });
});
