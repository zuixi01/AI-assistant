import { DocumentParser, ParsedDocument } from './parser.interface';
import { decodeTextBufferUtf8OrGb18030 } from '../utils/buffer-text-encoding';

export class TxtParser implements DocumentParser {
  readonly supportedTypes = ['txt', 'text'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    return { content: decodeTextBufferUtf8OrGb18030(buffer) };
  }
}
