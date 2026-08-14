// src/lib/docxExporter.ts
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType
} from "docx";
import { saveAs } from "file-saver";

interface TableRowData {
  cells: string[];
  isHeader?: boolean;
}

export async function exportToDocx(content: string, title: string = "8D Problem Solving Report") {
  const children: (Paragraph | Table)[] = [];
  const lines = content.split("\n");
  
  // Add Title with border
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, font: "Inter" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: "4F46E5" }
      }
    })
  );
  
  // Add metadata paragraph
  const dateStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "報告日期：", size: 20 }),
        new TextRun({ text: dateStr, size: 20, color: "57534E" })
      ],
      spacing: { after: 200 },
      alignment: AlignmentType.RIGHT
    })
  );

  let inTable = false;
  let tableRows: TableRowData[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      // Close any open table
      if (inTable && tableRows.length > 0) {
        children.push(createTable(tableRows));
        tableRows = [];
        inTable = false;
      }
      continue;
    }
    
    // Handle tables
    if (trimmed.startsWith("|")) {
      inTable = true;
      const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());
      tableRows.push({ cells, isHeader: tableRows.length === 0 });
      continue;
    }
    
    // Close table if we're no longer in one
    if (inTable && tableRows.length > 0) {
      children.push(createTable(tableRows));
      tableRows = [];
      inTable = false;
    }
    
    // Check for Headings
    if (trimmed.startsWith("# ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace("# ", ""), bold: true, size: 28, font: "Inter" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "E7E5E4" }
        }
      }));
    } else if (trimmed.startsWith("## ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace("## ", ""), bold: true, size: 24, font: "Inter", color: "1C1917" })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
        shading: { fill: "F8F8FC", type: ShadingType.CLEAR }
      }));
    } else if (trimmed.startsWith("### ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace("### ", ""), bold: true, size: 22, font: "Inter", color: "4F46E5" })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
    } else if (trimmed.startsWith("#### ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace("#### ", ""), bold: true, size: 20, font: "Inter", color: "57534E" })],
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 150, after: 80 }
      }));
    } else if (trimmed.match(/^[-*]\s/)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.substring(2), size: 20 })],
        bullet: { level: 0 },
        spacing: { after: 80 }
      }));
    } else if (trimmed.match(/^\d+\.\s/)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/^\d+\.\s/, ""), size: 20 })],
        numbering: { reference: "ordered-list", level: 0 },
        spacing: { after: 80 }
      }));
    } else {
      // Process inline formatting
      const runs = processInlineText(trimmed);
      children.push(new Paragraph({
        children: runs,
        spacing: { after: 100, line: 360 },
        alignment: AlignmentType.JUSTIFIED
      }));
    }
  }
  
  // Close any remaining table
  if (inTable && tableRows.length > 0) {
    children.push(createTable(tableRows));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Inter", size: 20 }
        }
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Inter" },
          paragraph: { spacing: { before: 400, after: 200 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Inter", color: "1C1917" },
          paragraph: { spacing: { before: 300, after: 150 }, shading: { fill: "F8F8FC", type: ShadingType.CLEAR } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 22, bold: true, font: "Inter", color: "4F46E5" },
          paragraph: { spacing: { before: 200, after: 100 } } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 20, bold: true, font: "Inter", color: "57534E" },
          paragraph: { spacing: { before: 150, after: 80 } } },
      ]
    },
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }]
        },
        {
          reference: "bullet-list",
          levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.START }]
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: children,
    }],
  });

  try {
    const blob = await Packer.toBlob(doc);
    const filename = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`;
    saveAs(blob, filename);
  } catch (error) {
    console.error("Export failed:", error);
  }
}

/**
 * Create a formatted table from row data
 */
function createTable(rows: TableRowData[]): Table {
  const width = 9360; // A4 width in DXA minus margins
  const numCols = rows[0]?.cells.length || 2;
  const cellWidth = Math.floor(width / numCols);
  
  const tableRows: TableRow[] = rows.map((row, index) => {
    const isHeader = row.isHeader || index === 0;
    
    const cells: TableCell[] = row.cells.map(cell => {
      return new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        shading: isHeader ? { fill: "F8F8FC", type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "E7E5E4" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E7E5E4" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E7E5E4" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E7E5E4" }
        },
        children: [new Paragraph({
          children: [new TextRun({ 
            text: cell, 
            bold: isHeader,
            font: "Inter", 
            size: isHeader ? 18 : 20,
            color: isHeader ? "4F46E5" : "1C1917"
          })],
          spacing: { after: 60 }
        })]
      });
    });
    
    return new TableRow({ children: cells });
  });
  
  return new Table({
    width: { size: width, type: WidthType.DXA },
    rows: tableRows,
    columnWidths: Array(numCols).fill(cellWidth)
  });
}

/**
 * Process inline text formatting (**bold**, *italic*)
 * Returns an array of text runs with formatting
 */
function processInlineText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let currentText = "";
  let inBold = false;
  let inItalic = false;
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    if (char === '*' && text[i+1] === '*') {
      if (currentText) {
        runs.push(new TextRun({ 
          text: currentText, 
          bold: inBold, 
          italics: inItalic,
          font: "Inter",
          size: 20
        }));
        currentText = "";
      }
      inBold = !inBold;
      i += 2;
      continue;
    }
    
    if (char === '*') {
      if (currentText) {
        runs.push(new TextRun({ 
          text: currentText, 
          bold: inBold, 
          italics: inItalic,
          font: "Inter",
          size: 20
        }));
        currentText = "";
      }
      inItalic = !inItalic;
      i++;
      continue;
    }
    
    currentText += char;
    i++;
  }
  
  if (currentText) {
    runs.push(new TextRun({ 
      text: currentText, 
      bold: inBold, 
      italics: inItalic,
      font: "Inter",
      size: 20
    }));
  }
  
  return runs.length > 0 ? runs : [new TextRun({ text, font: "Inter", size: 20 })];
}
