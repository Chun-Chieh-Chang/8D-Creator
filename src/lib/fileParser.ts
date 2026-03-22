// src/lib/fileParser.ts
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
      return await file.text();
    
    case 'xlsx':
    case 'xls':
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      let excelText = "";
      workbook.SheetNames.forEach(sheetName => {
        excelText += `Sheet: ${sheetName}\n`;
        const sheet = workbook.Sheets[sheetName];
        excelText += XLSX.utils.sheet_to_txt(sheet) + "\n";
      });
      return excelText;

    case 'docx':
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;

    case 'pdf':
      // Simplified PDF text extraction (requires pdfjs-dist setup which can be tricky in some environments)
      // For now, we'll suggest using a simpler approach or acknowledge the file.
      return `[PDF File: ${file.name} - Text extraction pending full implementation]`;

    default:
      return `[File: ${file.name} - Unsupported format for text extraction]`;
  }
}
