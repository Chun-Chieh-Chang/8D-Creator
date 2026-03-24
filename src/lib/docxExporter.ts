// src/lib/docxExporter.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

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
    
    // Explicitly re-wrap the blob to ensure the correct MIME type is set
    const wordBlob = new Blob([blob], { 
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
    });
    
    // Sanitize filename: remove any characters that are unsafe for Windows (e.g. : / \ * ? " < > |)
    const sanitizedTitle = (title || "8D_Report").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizedTitle}_${dateStr}.docx`;
    
    console.log("Preparing download for:", fileName, "Size:", wordBlob.size);
    
    const url = URL.createObjectURL(wordBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup with a slightly longer delay to ensure browser handles the request
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
    
    console.log("8D Report download triggered successfully:", fileName);
  } catch (error) {
    console.error("Critical Export Error:", error);
  }
}
