import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DocumentParser } from './parser.interface';
import { TxtParser } from './txt.parser';
import { MarkdownParser } from './markdown.parser';
import { PdfParser } from './pdf.parser';
import { DocxParser } from './docx.parser';
import { XlsxParser } from './xlsx.parser';
import { CsvParser } from './csv.parser';
import { PptxParser } from './pptx.parser';
import { ImageParser } from './image.parser';

@Injectable()
export class ParserFactory {
  private readonly logger = new Logger(ParserFactory.name);
  private parsers: DocumentParser[] = [
    new TxtParser(),
    new MarkdownParser(),
    new PdfParser(),
    new DocxParser(),
    new XlsxParser(),
    new CsvParser(),
    new PptxParser(),
    new ImageParser(),
  ];

  getParser(filename: string): DocumentParser {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const parser = this.parsers.find((p) => p.supportedTypes.includes(ext));
    if (!parser) {
      throw new BadRequestException(
        `Unsupported file type: .${ext}. Supported: ${this.supportedExtensions.join(', ')}`,
      );
    }
    return parser;
  }

  get supportedExtensions(): string[] {
    return this.parsers.flatMap((p) => p.supportedTypes);
  }

  async parse(buffer: Buffer, filename: string) {
    const parser = this.getParser(filename);
    this.logger.log(`Parsing ${filename} (${(buffer.length / 1024).toFixed(1)}KB) with ${parser.constructor.name}`);
    return parser.parse(buffer, filename);
  }
}
