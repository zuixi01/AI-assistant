import { describe, expect, it } from 'vitest';
import { MessageAdapterService } from '../../apps/api/src/platform/message-adapter.service';

describe('MessageAdapterService', () => {
  it('strips markdown into clean plain text bullets for non-markdown channels', () => {
    const service = new MessageAdapterService();

    const result = service.adaptReply('**您好**\n- 发货约3天\n- 支持售后', {
      channel: 'xiaohongshu',
      maxLength: 1000,
      supportsMarkdown: false,
      style: 'detailed',
    });

    expect(result).toBe('您好\n• 发货约3天\n• 支持售后');
  });

  it('removes common polite filler in concise replies', () => {
    const service = new MessageAdapterService();

    const result = service.adaptReply('您好，感谢您的咨询，发货约3天。如有其他问题，欢迎随时咨询。', {
      channel: 'juguang',
      maxLength: 1000,
      supportsMarkdown: false,
      style: 'concise',
    });

    expect(result).toBe('发货约3天。');
  });
});
