'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, Copy, Loader2, QrCode, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

interface SetupStatus {
  cryptoKey: boolean;
  appId: boolean;
  appSecret: boolean;
  accessToken: boolean;
  webhookVerify: boolean;
}

export default function XiaohongshuSetupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Step 1: Crypto Key
  const [cryptoKey, setCryptoKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Step 2: Credentials
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  // Step 3: OAuth
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiGet<SetupStatus>('/api/admin/setup/xiaohongshu/status');
      setStatus(data);

      // Determine initial step based on status
      if (!data.cryptoKey) {
        setStep(1);
      } else if (!data.appId) {
        setStep(2);
      } else if (!data.accessToken) {
        setStep(3);
      } else {
        setStep(4);
      }
    } catch (e) {
      console.error('Failed to load setup status', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      setStep(parseInt(stepParam, 10));
    }

    const oauth = searchParams.get('oauth');
    if (oauth === 'success') {
      setOauthStatus('success');
      setToast({ type: 'success', msg: 'OAuth authorization successful!' });
    } else if (oauth === 'error') {
      setOauthStatus('error');
      setOauthError(searchParams.get('msg') || 'OAuth authorization failed');
      setToast({ type: 'error', msg: searchParams.get('msg') || 'OAuth authorization failed' });
    }

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('step');
    url.searchParams.delete('oauth');
    url.searchParams.delete('msg');
    window.history.replaceState({}, '', url.toString());

    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleGenerateKey = async () => {
    setGenerating(true);
    try {
      const data = await apiPost<{ key: string }>('/api/admin/setup/xiaohongshu/generate-key', {});
      setCryptoKey(data.key);
      setToast({ type: 'success', msg: 'Crypto key generated successfully' });
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Failed to generate key' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(cryptoKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveCredentials = async () => {
    if (!appId) {
      setToast({ type: 'error', msg: 'APP_ID is required' });
      return;
    }

    setSaving(true);
    try {
      await apiPost('/api/admin/setup/xiaohongshu/save-credentials', { appId, appSecret });
      setToast({ type: 'success', msg: 'Credentials saved successfully' });
      setStep(3);
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateOAuthUrl = async () => {
    setOauthLoading(true);
    try {
      const data = await apiGet<{ url: string; state: string }>('/api/admin/setup/xiaohongshu/oauth/authorize');
      setOauthUrl(data.url);
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Failed to generate OAuth URL' });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    setCompleting(true);
    try {
      const result = await apiPost<{ success: boolean; message: string }>('/api/admin/setup/xiaohongshu/complete', {});
      if (result.success) {
        setToast({ type: 'success', msg: result.message });
        setStep(4);
        await loadStatus();
      } else {
        setToast({ type: 'error', msg: result.message });
      }
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Failed to complete setup' });
    } finally {
      setCompleting(false);
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading setup status...
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="premium-kicker">Setup Wizard</span>
          <h2 className="admin-page-title mt-3">小红书配置向导</h2>
          <p className="mt-2 text-sm text-slate-500">按照步骤完成小红书三方客服集成配置</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div className={`mx-2 h-0.5 w-16 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="mx-auto max-w-2xl">
        {/* Step 1: Generate Crypto Key */}
        {step === 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">第1步：生成加密密钥</h3>
            <p className="mt-2 text-sm text-slate-500">
              加密密钥用于小红书消息的加解密和webhook签名验证。系统将自动生成一个安全的32字符十六进制密钥。
            </p>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700">XHS_CRYPTO_KEY</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={cryptoKey}
                  readOnly
                  placeholder="点击生成按钮创建密钥"
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={handleCopyKey}
                  disabled={!cryptoKey}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {keyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleGenerateKey}
                disabled={generating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                生成密钥
              </button>
              <button
                onClick={handleNext}
                disabled={!cryptoKey}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                下一步
                <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Enter Credentials */}
        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">第2步：获取应用凭据</h3>
            <p className="mt-2 text-sm text-slate-500">
              请在小红书开放平台创建应用并获取凭据。
            </p>

            <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
              <p className="font-medium">操作步骤：</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>访问 <a href="https://open.xiaohongshu.com" target="_blank" rel="noopener noreferrer" className="underline">https://open.xiaohongshu.com</a></li>
                <li>创建应用并获取 APP_ID 和 APP_SECRET</li>
                <li>配置回调地址：<code className="rounded bg-blue-100 px-1">https://your-domain/api/admin/setup/xiaohongshu/oauth/callback</code></li>
              </ol>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">APP_ID *</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="输入小红书应用ID"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">APP_SECRET</label>
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="输入应用密钥（可选）"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 inline h-4 w-4" />
                上一步
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={saving || !appId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                保存并继续
              </button>
            </div>
          </div>
        )}

        {/* Step 3: OAuth Authorization */}
        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">第3步：扫码授权</h3>
            <p className="mt-2 text-sm text-slate-500">
              使用小红书APP扫码完成授权，获取访问令牌。
            </p>

            <div className="mt-6 flex flex-col items-center">
              {!oauthUrl ? (
                <button
                  onClick={handleGenerateOAuthUrl}
                  disabled={oauthLoading}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {oauthLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" />
                  )}
                  生成二维码
                </button>
              ) : (
                <div className="text-center">
                  <div className="mx-auto w-64 rounded-lg border-2 border-dashed border-slate-300 p-8">
                    <QrCode className="mx-auto h-32 w-32 text-slate-400" />
                    <p className="mt-4 text-sm text-slate-500">请使用小红书APP扫描二维码</p>
                  </div>
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-sm text-blue-600 underline"
                  >
                    点击这里在新窗口打开授权页面
                  </a>
                </div>
              )}

              {oauthStatus === 'success' && (
                <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
                  <Check className="mr-2 inline h-4 w-4" />
                  OAuth授权成功！请点击“完成配置”按钮保存配置。
                </div>
              )}

              {oauthStatus === 'error' && (
                <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  授权失败：{oauthError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 inline h-4 w-4" />
                上一步
              </button>
              <button
                onClick={handleCompleteSetup}
                disabled={completing || oauthStatus !== 'success'}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {completing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                完成配置
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">配置完成！</h3>
              <p className="mt-2 text-sm text-slate-500">
                小红书三方客服配置已成功保存。
              </p>
            </div>

            {status && (
              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <h4 className="text-sm font-medium text-slate-700">配置状态：</h4>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li className="flex items-center">
                    {status.cryptoKey ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <QrCode className="mr-2 h-4 w-4 text-slate-400" />}
                    XHS_CRYPTO_KEY: {status.cryptoKey ? '已配置' : '未配置'}
                  </li>
                  <li className="flex items-center">
                    {status.appId ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <QrCode className="mr-2 h-4 w-4 text-slate-400" />}
                    XHS_APP_ID: {status.appId ? '已配置' : '未配置'}
                  </li>
                  <li className="flex items-center">
                    {status.appSecret ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <QrCode className="mr-2 h-4 w-4 text-slate-400" />}
                    XHS_APP_SECRET: {status.appSecret ? '已配置' : '未配置'}
                  </li>
                  <li className="flex items-center">
                    {status.accessToken ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <QrCode className="mr-2 h-4 w-4 text-slate-400" />}
                    XHS_ACCESS_TOKEN: {status.accessToken ? '已配置' : '未配置'}
                  </li>
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => router.push('/admin/settings/xiaohongshu')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                前往小红书管理页面
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setCryptoKey('');
                  setAppId('');
                  setAppSecret('');
                  setOauthUrl('');
                  setOauthStatus('idle');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                重新配置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
