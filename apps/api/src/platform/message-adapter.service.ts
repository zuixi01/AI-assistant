import { Injectable, Logger } from '@nestjs/common';

interface AdaptOptions {
  channel: string;
  maxLength: number;
  supportsMarkdown: boolean;
  style: 'concise' | 'detailed' | 'professional';
}

interface PlatformCapabilities {
  supportsImages: boolean;
  supportsVoice: boolean;
  supportsCard: boolean;
  supportsLink: boolean;
  maxMessageLength: number;
  supportsMarkdown: boolean;
}

const PLATFORM_CAPABILITIES: Record<string, PlatformCapabilities> = {
  wechat: { supportsImages: true, supportsVoice: true, supportsCard: false, supportsLink: false, maxMessageLength: 600, supportsMarkdown: false },
  taobao: { supportsImages: true, supportsVoice: false, supportsCard: true, supportsLink: true, maxMessageLength: 2000, supportsMarkdown: false },
  pdd: { supportsImages: true, supportsVoice: false, supportsCard: false, supportsLink: false, maxMessageLength: 1500, supportsMarkdown: false },
  bilibili: { supportsImages: false, supportsVoice: false, supportsCard: false, supportsLink: true, maxMessageLength: 1000, supportsMarkdown: false },
  weibo: { supportsImages: true, supportsVoice: false, supportsCard: false, supportsLink: true, maxMessageLength: 2000, supportsMarkdown: true },
  zhihu: { supportsImages: true, supportsVoice: false, supportsCard: false, supportsLink: true, maxMessageLength: 5000, supportsMarkdown: true },
  douyin_enterprise: { supportsImages: true, supportsVoice: true, supportsCard: false, supportsLink: false, maxMessageLength: 800, supportsMarkdown: false },
  xiaohongshu: { supportsImages: true, supportsVoice: false, supportsCard: false, supportsLink: false, maxMessageLength: 1000, supportsMarkdown: false },
  juguang: { supportsImages: true, supportsVoice: false, supportsCard: false, supportsLink: false, maxMessageLength: 1000, supportsMarkdown: false },
};

@Injectable()
export class MessageAdapterService {
  private readonly logger = new Logger(MessageAdapterService.name);

  getCapabilities(channel: string): PlatformCapabilities {
    return PLATFORM_CAPABILITIES[channel] || {
      supportsImages: false,
      supportsVoice: false,
      supportsCard: false,
      supportsLink: false,
      maxMessageLength: 2000,
      supportsMarkdown: false,
    };
  }

  adaptReply(content: string, options: AdaptOptions): string {
    if (!content) return '';

    let result = content;

    // Strip markdown if not supported
    if (!options.supportsMarkdown) {
      result = this.stripMarkdown(result);
    }

    // Apply style adjustments
    if (options.style === 'concise') {
      result = this.makeConcise(result);
    }

    // Truncate if over max length
    if (result.length > options.maxLength) {
      result = result.substring(0, options.maxLength - 3) + '...';
    }

    return this.normalizeText(result);
  }

  parseIncomingMessage(content: string, channel: string): string {
    if (!content) return '';
    // Strip channel-specific formatting
    let result = content.trim();
    // Remove @mentions common in some platforms
    result = result.replace(/@\w+\s*/g, '');
    return result;
  }

  stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')      // bold
      .replace(/\*(.*?)\*/g, '$1')            // italic
      .replace(/__(.*?)__/g, '$1')            // underline
      .replace(/~~(.*?)~~/g, '$1')            // strikethrough
      .replace(/`{3}[\s\S]*?`{3}/g, (m) => { // code blocks
        const lines = m.split('\n').slice(1, -1);
        return lines.join('\n');
      })
      .replace(/`(.*?)`/g, '$1')              // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/^#{1,6}\s+/gm, '')            // headers
      .replace(/^[-*+]\s+/gm, '• ')           // unordered lists
      .replace(/^\d+\.\s+/gm, (m) => m)       // ordered lists
      .replace(/^>\s+/gm, '')                 // blockquotes
      .replace(/---+/g, '')                   // horizontal rules
      .replace(/\n{3,}/g, '\n\n')             // excessive newlines
      .trim();
  }

  makeConcise(text: string): string {
    // Remove filler phrases
    let result = text;
    const fillers = [
      '您好，', '你好，', '感谢您的咨询，', '感谢您的提问，',
      '很高兴为您服务，', '非常抱歉给您带来不便，',
      '希望以上信息对您有帮助', '如有其他问题，欢迎随时咨询',
      '如果您还有其他问题，', '请问还有什么可以帮您的吗？',
    ];
    for (const filler of fillers) {
      result = result.replace(filler, '');
    }
    // Collapse multiple sentences into shorter form
    result = result.replace(/。\s*/g, '。').replace(/，\s*/g, '，');
    return this.normalizeText(result);
  }

  private normalizeText(text: string): string {
    return text
      .replace(/。{2,}/g, '。')
      .replace(/，{2,}/g, '，')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
