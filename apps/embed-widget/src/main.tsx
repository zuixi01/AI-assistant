import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './ChatWidget';

function Demo() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>AI Chat Widget Demo</h1>
      <p>点击右下角的聊天按钮开始对话</p>
      <ChatWidget
        apiBaseUrl="http://localhost:4000"
        tenantId="t-ecommerce-101"
        position="bottom-right"
        primaryColor="#2563eb"
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
