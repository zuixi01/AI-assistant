import { DocumentParser, ParsedDocument } from './parser.interface';
import { parse as csvParse } from 'csv-parse/sync';
import { decodeTextBufferUtf8OrGb18030 } from '../utils/buffer-text-encoding';

export class CsvParser implements DocumentParser {
  readonly supportedTypes = ['csv'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const text = decodeTextBufferUtf8OrGb18030(buffer);
    const records = csvParse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (records.length === 0) {
      return { content: '' };
    }

    // Get headers from first record
    const headers = Object.keys(records[0] as Record<string, string>);

    // Format as readable text: each row as "Header1: Value1, Header2: Value2"
    const lines = records.map((row: Record<string, string>) =>
      headers
        .filter((h) => row[h] !== undefined && row[h] !== '')
        .map((h) => `${h}: ${row[h]}`)
        .join(' | '),
    );

    return {
      content: lines.join('\n'),
      metadata: {
        headers,
        rowCount: records.length,
        rawRecords: records,
      },
    };
  }
}
