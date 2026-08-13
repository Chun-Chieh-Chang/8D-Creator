import ReactMarkdown from "react-markdown";

/**
 * Export 8D report as a standalone HTML file
 */
export function exportToHtml(content: string, title: string = "8D Problem Solving Report") {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${title.replace(/\s+/g, "_")}_${timestamp}.html`;
  
  // Convert markdown to HTML using react-markdown
  const htmlContent = generateHtmlDocument(content, title);
  
  // Create blob and download
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateHtmlDocument(markdown: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --color-primary: #2563EB;
      --color-text: #1F2937;
      --color-muted: #6B7280;
      --color-border: #E5E7EB;
      --bg-page: #F3F4F6;
      --bg-card: #FFFFFF;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.7;
      color: var(--color-text);
      background: var(--bg-page);
      padding: 2rem 1rem;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--bg-card);
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-primary);
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 3px solid var(--color-primary);
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      margin-top: 2rem;
      margin-bottom: 1rem;
      padding-left: 1rem;
      border-left: 4px solid var(--color-primary);
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text);
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }
    
    p {
      margin-bottom: 1rem;
      text-align: justify;
    }
    
    ul, ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    strong {
      font-weight: 600;
      color: var(--color-primary);
    }
    
    hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 2rem 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }
    
    th, td {
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      text-align: left;
    }
    
    th {
      background: var(--bg-page);
      font-weight: 600;
    }
    
    .header-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--bg-page);
      border-radius: 8px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .info-value {
      font-size: 1rem;
      color: var(--color-text);
      font-weight: 500;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        max-width: 100%;
      }
    }
    
    @media (max-width: 640px) {
      .container {
        padding: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="markdown-content">
${convertMarkdownToHtml(markdown)}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Simple markdown to HTML converter
 * Handles headings, lists, bold, italic, code blocks
 */
function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let listType = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines outside lists
    if (!trimmed) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = "";
      }
      continue;
    }
    
    // Headings
    if (trimmed.startsWith("# ")) {
      html += `<h1>${processInlineFormatting(trimmed.substring(2))}</h1>\n`;
    } else if (trimmed.startsWith("## ")) {
      html += `<h2>${processInlineFormatting(trimmed.substring(3))}</h2>\n`;
    } else if (trimmed.startsWith("### ")) {
      html += `<h3>${processInlineFormatting(trimmed.substring(4))}</h3>\n`;
    } else if (trimmed.startsWith("#### ")) {
      html += `<h4>${processInlineFormatting(trimmed.substring(5))}</h4>\n`;
    }
    // Unordered lists
    else if (trimmed.match(/^[-*]\s/)) {
      if (!inList || listType !== "ul") {
        if (inList) html += `</${listType}>\n`;
        html += `<ul>\n`;
        inList = true;
        listType = "ul";
      }
      html += `<li>${processInlineFormatting(trimmed.substring(2))}</li>\n`;
    }
    // Ordered lists
    else if (trimmed.match(/^\d+\.\s/)) {
      if (!inList || listType !== "ol") {
        if (inList) html += `</${listType}>\n`;
        html += `<ol>\n`;
        inList = true;
        listType = "ol";
      }
      html += `<li>${processInlineFormatting(trimmed.replace(/^\d+\.\s/, ""))}</li>\n`;
    }
    // Horizontal rule
    else if (trimmed === "---" || trimmed === "***") {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = "";
      }
      html += `<hr>\n`;
    }
    // Paragraph
    else {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = "";
      }
      html += `<p>${processInlineFormatting(trimmed)}</p>\n`;
    }
  }
  
  // Close any open list
  if (inList) {
    html += `</${listType}>\n`;
  }
  
  return html;
}

/**
 * Process inline formatting: **bold**, *italic*, `code`, [link](url)
 */
function processInlineFormatting(text: string): string {
  // Code spans
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}
