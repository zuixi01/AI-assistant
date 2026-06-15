import { BadRequestException } from '@nestjs/common';

export const ADMIN_AUTH_COOKIE = 'admin_token';
export const DEFAULT_ADMIN_JWT_EXPIRES_IN = '8h';
export const DEFAULT_ADMIN_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const UNSAFE_JWT_SECRETS = new Set([
  'default_secret',
  'change_me',
  'change_me_in_production',
  'change_me_32_bytes_min_length',
  'replace_with_48_byte_random_secret',
  'replace_with_32_byte_random_key',
]);

interface ConfigLike {
  get<T = string>(key: string, defaultValue?: T): T | undefined;
}

export function getRequiredJwtSecret(config: ConfigLike): string {
  const secret = String(config.get<string>('JWT_SECRET') || '').trim();
  if (!secret || UNSAFE_JWT_SECRETS.has(secret)) {
    throw new BadRequestException('JWT_SECRET must be configured with a production-safe value');
  }
  return secret;
}

export function getAdminJwtExpiresIn(config: ConfigLike): string {
  return String(config.get<string>('ADMIN_JWT_EXPIRES_IN') || DEFAULT_ADMIN_JWT_EXPIRES_IN);
}

export function buildAdminCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DEFAULT_ADMIN_COOKIE_MAX_AGE_MS,
  };
}

export function buildAdminClearCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});
}

export function extractJwtFromRequest(req: any): string | null {
  const cookieToken = req?.cookies?.[ADMIN_AUTH_COOKIE]
    || req?.signedCookies?.[ADMIN_AUTH_COOKIE]
    || parseCookieHeader(req?.headers?.cookie)[ADMIN_AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const authorization = req?.headers?.authorization;
  if (typeof authorization === 'string') {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1];
  }
  return null;
}
