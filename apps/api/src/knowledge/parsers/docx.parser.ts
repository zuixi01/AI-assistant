import { DocumentParser, ParsedDocument, ContentSection } from './parser.interface';

export class DocxParser implements DocumentParser {
  readonly supportedTypes = ['docx'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      const sections: ContentSection[] = [];

      // Detect tables in the extracted text (mammoth represents tables with indentation)
      const tableSections = this.detectTables(result.value);
      sections.push(...tableSections);

      return {
        content: result.value,
        metadata: { warnings: result.messages },
        sections,
      };
    } catch (error: any) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  private detectTables(text: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = text.split('\n');
    let sectionIdx = 0;

    // Detect lines with tab-separated values (mammoth renders tables as tab-separated)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((line.match(/\t/g) || []).length >= 2) {
        const tableRows: string[][] = [];
        let j = i;
        while (j < lines.length && (lines[j].match(/\t/g) || []).length >= 2) {
          tableRows.push(lines[j].split('\t').map((c) => c.trim()));
          j++;
        }
        if (tableRows.length >= 2) {
          sections.push({
            type: 'table',
            content: tableRows.map((r) => r.join(' | ')).join('\n'),
            sectionIndex: sectionIdx++,
            metadata: { tableHeaders: tableRows[0], tableRows },
          });
          i = j - 1;
        }
      }
    }
    return sections;
  }
}
