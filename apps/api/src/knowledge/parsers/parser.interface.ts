/** A section of multimodal content extracted from a document */
export interface ContentSection {
  type: 'text' | 'table' | 'image' | 'formula' | 'chart';
  content: string;
  sectionIndex: number;
  metadata?: {
    pageNumber?: number;
    caption?: string;
    /** Table-specific: structured data */
    tableHeaders?: string[];
    tableRows?: string[][];
    /** Image-specific */
    imageBase64?: string;
    imageDescription?: string;
    imageMime?: string;
    /** Formula-specific */
    latex?: string;
    formulaType?: string;
    /** Chart-specific */
    chartType?: string;
    chartData?: string;
    /** Sheet-specific (for spreadsheets) */
    sheetName?: string;
  };
}

export interface ParsedDocument {
  /** Full plain-text content (backward compatible) */
  content: string;
  metadata?: Record<string, any>;
  /** Multimodal content sections extracted from the document */
  sections?: ContentSection[];
}

export interface DocumentParser {
  readonly supportedTypes: string[];
  parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;

  /** Optional: extract tables with structured data */
  extractTables?(buffer: Buffer, filename: string): Promise<ContentSection[]>;

  /** Optional: extract embedded images */
  extractImages?(buffer: Buffer, filename: string): Promise<ContentSection[]>;

  /** Optional: extract math formulas */
  extractFormulas?(buffer: Buffer, filename: string): Promise<ContentSection[]>;
}
