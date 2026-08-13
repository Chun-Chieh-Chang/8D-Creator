// src/lib/fileParser.ts
// Lazy-loaded heavy dependencies for bundle size optimization

export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
      return await file.text();
    
    case 'xlsx':
    case 'xls':
      // Dynamic import for lazy loading
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      let excelText = "";
      workbook.SheetNames.forEach((sheetName: string) => {
        excelText += `Sheet: ${sheetName}\n`;
        const sheet = workbook.Sheets[sheetName];
        excelText += XLSX.utils.sheet_to_txt(sheet) + "\n";
      });
      return excelText;

    case 'docx':
      // Dynamic import for lazy loading
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;

    case 'pdf':
      // PDF parsing requires more setup, placeholder for now
      return `[PDF File: ${file.name} - Text extraction pending implementation]`;

    default:
      return `[File: ${file.name} - Unsupported format for text extraction]`;
  }
}
