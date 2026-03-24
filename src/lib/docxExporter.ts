// src/lib/docxExporter.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export async function exportToDocx(content: string, title: string = "8D Problem Solving Report") {
  const lines = content.split("\n");
  const children: Paragraph[] = [];
  
  // Add Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      spacing: { after: 400 },
    })
  );

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }
    
    // Check for Headings
    if (trimmed.startsWith("# ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.replace("# ", ""), bold: true, size: 28 })],
        spacing: { before: 200, after: 100 }
      }));
    } else if (trimmed.startsWith("## ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.replace("## ", ""), bold: true, size: 24 })],
        spacing: { before: 150, after: 100 }
      }));
    } else if (trimmed.startsWith("### ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_4,
        children: [new TextRun({ text: trimmed.replace("### ", ""), bold: true, size: 20 })],
        spacing: { before: 100, after: 100 }
      }));
    } else if (trimmed.match(/^[\*\-]\s/)) {
      children.push(new Paragraph({
        children: [new TextRun(trimmed.substring(2))],
        bullet: { level: 0 },
        spacing: { after: 100 }
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun(trimmed)],
        spacing: { after: 100 }
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  try {
    const blob = await Packer.toBlob(doc);
    const fileName = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`;
    
    // Use a more direct native download method to avoid naming issues
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log("8D Report exported successfully:", fileName);
  } catch (error) {
    console.error("Export failed:", error);
  }
}
