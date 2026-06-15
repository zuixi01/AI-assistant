import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './ChatWidget';

interface AIChatWidgetConfig {
  apiBaseUrl: string;
  tenantId: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export function initAIChatWidget(config: AIChatWidgetConfig) {
  const container = document.createElement('div');
  container.id = 'ai-chat-widget-root';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ChatWidget {...config} />);
}

// Auto-init if config is in global
if (typeof window !== 'undefined') {
  (window as any).AIChatWidget = { init: initAIChatWidget };
}
