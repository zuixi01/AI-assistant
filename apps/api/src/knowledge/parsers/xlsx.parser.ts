import { DocumentParser, ParsedDocument, ContentSection } from './parser.interface';
import * as XLSX from 'xlsx';

export class XlsxParser implements DocumentParser {
  readonly supportedTypes = ['xlsx', 'xls'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const allContent: string[] = [];
    const sections: ContentSection[] = [];
    let sectionIdx = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Convert to CSV text for text content
      const csvText = XLSX.utils.sheet_to_csv(sheet);
      allContent.push(`## Sheet: ${sheetName}\n\n${csvText}`);

      // Extract structured table data
      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      if (jsonData.length > 0) {
        const headers = (jsonData[0] || []).map((h: string) => String(h));
        const rows = jsonData.slice(1).map((row: string[]) => row.map((c) => String(c)));

        sections.push({
          type: 'table',
          content: csvText,
          sectionIndex: sectionIdx++,
          metadata: {
            sheetName,
            tableHeaders: headers,
            tableRows: rows,
          },
        });
      }
    }

    return {
      content: allContent.join('\n\n'),
      metadata: {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
      },
      sections,
    };
  }
}
