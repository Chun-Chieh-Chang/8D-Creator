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
  const processedMarkdown = processMarkdown(markdown);
  
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      /* Premium Color Palette - Indigo Professional Theme */
      --color-primary: #4F46E5;
      --color-primary-light: #EEF2FF;
      --color-primary-dark: #3730A3;
      --color-secondary: #059669;
      --color-secondary-light: #ECFDF5;
      --color-accent: #DC2626;
      --color-accent-light: #FEF2F2;
      --color-warning: #D97706;
      --color-warning-light: #FFFBEB;
      
      --color-text-primary: #1C1917;
      --color-text-secondary: #57534E;
      --color-text-muted: #78716C;
      --color-border: #E7E5E4;
      --color-border-light: #F5F5F4;
      
      --bg-page: #FAFAF9;
      --bg-card: #FFFFFF;
      --bg-section: #F8F8FC;
      
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
      --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.12);
      
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --color-primary: #6366F1;
        --color-primary-light: #1E1B4B;
        --color-primary-dark: #818CF8;
        --color-text-primary: #FAFAF9;
        --color-text-secondary: #A1A1AA;
        --color-text-muted: #71717A;
        --color-border: #27272A;
        --color-border-light: #18181B;
        --bg-page: #09090B;
        --bg-card: #18181B;
        --bg-section: #1C1C21;
        --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
        --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
        --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--font-sans);
      line-height: 1.75;
      color: var(--color-text-primary);
      background: var(--bg-page);
      padding: 0;
    }
    
    .report-wrapper {
      max-width: 960px;
      margin: 0 auto;
      background: var(--bg-card);
      min-height: 100vh;
    }
    
    /* Header */
    .report-header {
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
      color: white;
      padding: 3rem 4rem;
      position: relative;
      overflow: hidden;
    }
    
    .report-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .report-header::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: 10%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .report-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 0.5rem 1rem;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1.5rem;
    }
    
    .report-title {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin-bottom: 0.75rem;
    }
    
    .report-subtitle {
      font-size: 1.1rem;
      opacity: 0.85;
      font-weight: 400;
    }
    
    /* Metadata Section */
    .report-meta {
      padding: 2rem 4rem;
      background: var(--bg-section);
      border-bottom: 1px solid var(--color-border);
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .meta-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }
    
    .meta-value {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--color-text-primary);
    }
    
    /* Content Area */
    .report-content {
      padding: 3rem 4rem;
    }
    
    /* Sections */
    .section {
      margin-bottom: 3rem;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--color-border-light);
    }
    
    .section-number {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
      color: white;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 700;
    }
    
    .section-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }
    
    /* Typography */
    h1 {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
      color: var(--color-text-primary);
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      color: var(--color-text-primary);
      padding-left: 1rem;
      border-left: 4px solid var(--color-primary);
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: var(--color-text-primary);
    }
    
    h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: var(--color-text-secondary);
    }
    
    p {
      margin-bottom: 1rem;
      color: var(--color-text-primary);
      text-align: justify;
    }
    
    /* Lists */
    ul, ol {
      margin-bottom: 1rem;
      padding-left: 1.75rem;
    }
    
    li {
      margin-bottom: 0.5rem;
      color: var(--color-text-primary);
    }
    
    ul li::marker {
      color: var(--color-primary);
    }
    
    ol li::marker {
      color: var(--color-primary);
      font-weight: 600;
    }
    
    /* Strong/Bold */
    strong {
      font-weight: 600;
      color: var(--color-text-primary);
    }
    
    /* Horizontal Rule */
    hr {
      border: none;
      height: 1px;
      background: var(--color-border);
      margin: 2.5rem 0;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.9375rem;
    }
    
    th {
      background: var(--bg-section);
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--color-text-secondary);
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--color-border);
    }
    
    td {
      padding: 1rem;
      border-bottom: 1px solid var(--color-border-light);
      color: var(--color-text-primary);
    }
    
    tr:hover td {
      background: var(--bg-section);
    }
    
    /* Code */
    code {
      font-family: var(--font-mono);
      background: var(--bg-section);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.875rem;
      color: var(--color-primary);
    }
    
    pre {
      background: var(--bg-section);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1.25rem;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    pre code {
      background: transparent;
      padding: 0;
    }
    
    /* Blockquote */
    blockquote {
      border-left: 4px solid var(--color-primary);
      background: var(--bg-section);
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 8px 8px 0;
    }
    
    blockquote p {
      margin: 0;
      color: var(--color-text-secondary);
      font-style: italic;
    }
    
    /* Risk Badge */
    .risk-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.875rem;
      border-radius: 50px;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    
    .risk-high {
      background: var(--color-accent-light);
      color: var(--color-accent);
    }
    
    .risk-medium {
      background: var(--color-warning-light);
      color: var(--color-warning);
    }
    
    .risk-low {
      background: var(--color-secondary-light);
      color: var(--color-secondary);
    }
    
    /* Footer */
    .report-footer {
      padding: 2rem 4rem;
      background: var(--bg-section);
      border-top: 1px solid var(--color-border);
      text-align: center;
    }
    
    .footer-content {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
    }
    
    .footer-brand {
      font-weight: 600;
      color: var(--color-primary);
    }
    
    /* Print Styles */
    @media print {
      body {
        background: white;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .report-wrapper {
        box-shadow: none;
      }
      
      .report-header {
        padding: 2rem;
      }
      
      .report-content {
        padding: 2rem;
      }
      
      .report-footer {
        padding: 1.5rem;
      }
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .report-header {
        padding: 2rem;
      }
      
      .report-meta {
        padding: 1.5rem;
      }
      
      .report-content {
        padding: 1.5rem;
      }
      
      .report-footer {
        padding: 1.5rem;
      }
      
      .report-title {
        font-size: 1.75rem;
      }
      
      .meta-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    <header class="report-header">
      <div class="header-content">
        <div class="report-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          8D 問題解決報告
        </div>
        <h1 class="report-title">${escapeHtml(title)}</h1>
        <p class="report-subtitle">AI 驅動的根本原因分析與持續改進報告</p>
      </div>
    </header>
    
    <section class="report-meta">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">報告日期</span>
          <span class="meta-value">${new Date().toLocaleDateString('zh-TW')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">生成方式</span>
          <span class="meta-value">AI 協作分析</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">報告版本</span>
          <span class="meta-value">v1.0</span>
        </div>
      </div>
    </section>
    
    <main class="report-content">
      ${processedMarkdown}
    </main>
    
    <footer class="report-footer">
      <div class="footer-content">
        <p><span class="footer-brand">AI 8D Generator</span> | 8D Problem Solving Report</p>
        <p style="margin-top: 0.5rem; font-size: 0.75rem;">© ${new Date().getFullYear()} Generated with AI Collaboration</p>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Process markdown and add section styling
 */
function processMarkdown(markdown: string): string {
  // Add section headers for 8D structure
  let processed = markdown;
  
  // Add numbering to H2 headings if they don't have numbers
  processed = processed.replace(/^## ([^\d#][^\n]*)$/gm, (match, content) => {
    return `## ${content}`;
  });
  
  // Convert markdown to HTML
  const html = convertMarkdownToHtml(processed);
  
  return html;
}

/**
 * Simple markdown to HTML converter
 * Handles headings, lists, bold, italic, code blocks, tables
 */
function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let listType = "";
  let inTable = false;
  let tableRows: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines outside lists
    if (!trimmed) {
      if (inTable) {
        html += renderTable(tableRows);
        tableRows = [];
        inTable = false;
      }
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = "";
      }
      continue;
    }
    
    // Tables
    if (trimmed.startsWith("|")) {
      inTable = true;
      tableRows.push(trimmed);
      continue;
    }
    
    // Headings
    if (trimmed.startsWith("# ")) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<h1>${processInlineFormatting(trimmed.substring(2))}</h1>\n`;
    } else if (trimmed.startsWith("## ")) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<h2>${processInlineFormatting(trimmed.substring(3))}</h2>\n`;
    } else if (trimmed.startsWith("### ")) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<h3>${processInlineFormatting(trimmed.substring(4))}</h3>\n`;
    } else if (trimmed.startsWith("#### ")) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<h4>${processInlineFormatting(trimmed.substring(5))}</h4>\n`;
    }
    // Unordered lists
    else if (trimmed.match(/^[-*]\s/)) {
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
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
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
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
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<hr>\n`;
    }
    // Paragraph
    else {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ""; }
      if (inTable) { html += renderTable(tableRows); tableRows = []; inTable = false; }
      html += `<p>${processInlineFormatting(trimmed)}</p>\n`;
    }
  }
  
  // Close any open structures
  if (inList) {
    html += `</${listType}>\n`;
  }
  if (inTable && tableRows.length > 0) {
    html += renderTable(tableRows);
  }
  
  return html;
}

/**
 * Render table rows to HTML
 */
function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";
  
  let html = '<table>\n';
  
  rows.forEach((row, index) => {
    // Normalize whitespace
    const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
    
    if (index === 0) {
      html += '<thead><tr>\n';
      cells.forEach(cell => {
        html += `<th>${processInlineFormatting(cell)}</th>\n`;
      });
      html += '</tr></thead>\n';
    } else if (index === 1 && cells.every(c => /^[-:]+$/.test(c))) {
      // Skip separator row
      return;
    } else {
      html += '<tbody><tr>\n';
      cells.forEach(cell => {
        html += `<td>${processInlineFormatting(cell)}</td>\n`;
      });
      html += '</tr></tbody>\n';
    }
  });
  
  html += '</table>\n';
  return html;
}

/**
 * Process inline formatting: **bold**, *italic*, `code`, [link](url)
 */
function processInlineFormatting(text: string): string {
  // Escape HTML first
  text = escapeHtml(text);
  
  // Code spans
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
