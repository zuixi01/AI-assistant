import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export interface XhsAccount {
  id: string;
  userId: string;
  appId: string;
  accountCode: string;
  nickName: string | null;
  accountType: string;
  status: string;
  createdAt: string;
}

export interface JuguangAccount {
  id: string;
  appId: string;
  appSecret: string;
  accountName: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpires: string | null;
  autoReply: boolean;
  status: string;
}

export interface JuguangForm {
  appId: string;
  appSecret: string;
  accountName: string;
  accessToken: string;
  refreshToken: string;
  autoReply: boolean;
}

export function createEmptyJuguangForm(): JuguangForm {
  return {
    appId: '',
    appSecret: '',
    accountName: '',
    accessToken: '',
    refreshToken: '',
    autoReply: true,
  };
}

export function createJuguangFormFromAccount(account: JuguangAccount): JuguangForm {
  return {
    appId: account.appId,
    appSecret: account.appSecret,
    accountName: account.accountName || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    autoReply: account.autoReply,
  };
}

export function buildIntegrationWebhookUrl(path: string) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${path}`;
}

export async function listXhsAccounts() {
  const data = await apiGet<XhsAccount[]>('/api/admin/integrations/xiaohongshu/accounts');
  return Array.isArray(data) ? data : [];
}

export async function getXhsAuthUrl() {
  return apiGet<{ url: string; state: string }>('/api/admin/integrations/xiaohongshu/oauth/authorize');
}

export async function removeXhsAccount(id: string) {
  return apiDelete(`/api/admin/integrations/xiaohongshu/accounts/${id}`);
}

export async function listJuguangAccounts() {
  const data = await apiGet<JuguangAccount[]>('/api/admin/integrations/juguang/accounts');
  return Array.isArray(data) ? data : [];
}

export async function saveJuguangAccount(editingId: string | null, form: JuguangForm) {
  if (editingId) {
    return apiPatch(`/api/admin/integrations/juguang/accounts/${editingId}`, form);
  }
  return apiPost('/api/admin/integrations/juguang/accounts', form);
}

export async function removeJuguangAccount(id: string) {
  return apiDelete(`/api/admin/integrations/juguang/accounts/${id}`);
}

export async function refreshJuguangAccountToken(id: string) {
  return apiPost(`/api/admin/integrations/juguang/accounts/${id}/refresh-token`);
}
