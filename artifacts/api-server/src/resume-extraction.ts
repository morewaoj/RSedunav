import mammoth from 'mammoth';

// Dynamic import for pdf-parse due to ESM/CommonJS issues
let pdfParse: any = null;

async function getPdfParser() {
  if (!pdfParse) {
    try {
      const module = await import('pdf-parse') as any;
      pdfParse = module.default || module;
    } catch (error) {
      console.error('Failed to load pdf-parse:', error);
      throw new Error('PDF parsing library not available');
    }
  }
  return pdfParse;
}

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  error?: string;
}

export async function extractTextFromResume(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  try {
    if (mimeType === 'application/pdf') {
      return await extractFromPDF(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return await extractFromDOCX(buffer);
    } else if (mimeType === 'text/plain') {
      return { text: buffer.toString('utf-8') };
    } else {
      return { text: '', error: `Unsupported file type: ${mimeType}` };
    }
  } catch (error) {
    console.error('Resume extraction error:', error);
    return { 
      text: '', 
      error: error instanceof Error ? error.message : 'Unknown extraction error' 
    };
  }
}

async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const parser = await getPdfParser();
    const data = await parser(buffer);
    return {
      text: data.text,
      pageCount: data.numpages
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value
    };
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

export function validateResumeFile(
  file: Express.Multer.File
): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];
  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Please upload PDF, DOCX, DOC, or TXT files' };
  }

  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  return { valid: true };
}
