import { DocumentParser, ParsedDocument } from './parser.interface';
import { decodeTextBufferUtf8OrGb18030 } from '../utils/buffer-text-encoding';

export class MarkdownParser implements DocumentParser {
  readonly supportedTypes = ['md', 'markdown'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const content = decodeTextBufferUtf8OrGb18030(buffer);
    // Strip markdown formatting for plain text extraction
    const plainText = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.+?\)/g, '')
      .replace(/^\s*[-*+]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '')
      .trim();

    return { content: plainText, metadata: { originalFormat: 'markdown' } };
  }
}
