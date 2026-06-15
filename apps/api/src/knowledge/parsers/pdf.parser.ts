import { DocumentParser, ParsedDocument, ContentSection } from './parser.interface';

export class PdfParser implements DocumentParser {
  readonly supportedTypes = ['pdf'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);

      const sections: ContentSection[] = [];
      const text = data.text || '';

      // Detect and extract table-like content (lines with consistent delimiters)
      const tableSections = this.extractTableSections(text);
      sections.push(...tableSections);

      // Detect potential image references
      const imageRefs = this.extractImageReferences(text);
      sections.push(...imageRefs);

      return {
        content: text,
        metadata: { pages: data.numpages, info: data.info },
        sections,
      };
    } catch (error: any) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private extractTableSections(text: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = text.split('\n');
    let sectionIdx = 0;

    // Heuristic: detect lines with multiple tab/pipe/comma-separated columns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for pipe-separated or multi-tab data
      const pipeCount = (line.match(/\|/g) || []).length;
      const tabCount = (line.match(/\t/g) || []).length;

      if (pipeCount >= 2 || tabCount >= 2) {
        const delimiter = pipeCount >= 2 ? '|' : '\t';
        const cols = line.split(delimiter).map((c) => c.trim());

        // Gather consecutive delimited lines as one table
        const tableRows: string[][] = [cols];
        let j = i + 1;
        while (j < lines.length && lines[j].trim()) {
          const nextLine = lines[j].trim();
          const nextCols = nextLine.split(delimiter).map((c) => c.trim());
          if (nextCols.length >= cols.length - 1 && nextCols.length <= cols.length + 1) {
            tableRows.push(nextCols);
            j++;
          } else {
            break;
          }
        }

        if (tableRows.length >= 2) {
          const tableContent = tableRows.map((r) => r.join(' | ')).join('\n');
          sections.push({
            type: 'table',
            content: tableContent,
            sectionIndex: sectionIdx++,
            metadata: {
              pageNumber: this.estimatePage(text, i),
              tableHeaders: tableRows[0],
              tableRows,
            },
          });
          i = j - 1;
        }
      }
    }

    return sections;
  }

  private extractImageReferences(text: string): ContentSection[] {
    const sections: ContentSection[] = [];
    // Common patterns in extracted PDF text for images/figures
    const figureRegex = /(?:Figure|Fig\.|图表|图|Table|表)\s*(\d+)[：:]\s*(.+)/gi;
    let match;
    let idx = 0;
    while ((match = figureRegex.exec(text)) !== null) {
      sections.push({
        type: 'image',
        content: match[2]?.trim() || match[0],
        sectionIndex: idx++,
        metadata: {
          caption: match[0],
          pageNumber: this.estimatePage(text, match.index),
        },
      });
    }
    return sections;
  }

  private estimatePage(_text: string, _position: number): number | undefined {
    return undefined; // pdf-parse doesn't provide per-page positions reliably
  }
}
