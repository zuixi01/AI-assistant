import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'AI 智能客服助手',
  description: '面向企业售前、售后、线索沉淀与人工协同的 AI 智能客服系统',
};

const chunkLoadRecoveryScript = `
  (() => {
    const RECOVERY_FLAG = 'chunk-load-recovery-attempted';
    const patterns = [
      /ChunkLoadError/i,
      /Loading chunk [\\\\w/-]+ failed/i,
      /Loading CSS chunk [\\\\w/-]+ failed/i,
    ];

    const getMessage = (input) => {
      if (!input) return '';
      if (typeof input === 'string') return input;
      if (typeof input === 'object') {
        if (typeof input.message === 'string') return input.message;
        if (typeof input.name === 'string') return input.name;
      }
      return '';
    };

    const isChunkLoadError = (input) => {
      const message = getMessage(input);
      return patterns.some((pattern) => pattern.test(message));
    };

    const recover = () => {
      try {
        if (window.sessionStorage.getItem(RECOVERY_FLAG) === '1') return;
        window.sessionStorage.setItem(RECOVERY_FLAG, '1');
      } catch {}
      window.location.reload();
    };

    try {
      if (window.sessionStorage.getItem(RECOVERY_FLAG) === '1') {
        window.sessionStorage.removeItem(RECOVERY_FLAG);
      }
    } catch {}

    window.addEventListener('error', (event) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        recover();
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (isChunkLoadError(event.reason)) {
        recover();
      }
    });
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <Script id="chunk-load-recovery" strategy="beforeInteractive">
          {chunkLoadRecoveryScript}
        </Script>
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
