/**
 * PDF 匯出工具
 * 提供專業的 PDF 生成能力
 */

export interface PdfExportOptions {
  title: string;
  content: string;
  metadata?: {
    date?: string;
    customer?: string;
    product?: string;
    version?: string;
  };
  brandSettings?: {
    companyName?: string;
    primaryColor?: string;
  };
}

/**
 * 開啟列印對話框以導出 PDF
 * 這是相容性最好的方式，支援所有瀏覽器
 */
export function exportToPdf(options: PdfExportOptions): void {
  const { title, content, metadata = {}, brandSettings = {} } = options;
  
  // 生成臨時 iframe 用於列印
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('無法開啟列印視窗，請檢查瀏覽器設定');
    return;
  }
  
  const htmlContent = generatePrintHtml({
    title,
    content,
    metadata,
    brandSettings
  });
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // 等待圖片載入後觸發列印
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

/**
 * 生成列印用 HTML
 */
function generatePrintHtml(options: {
  title: string;
  content: string;
  metadata: Record<string, string>;
  brandSettings: Record<string, string>;
}): string {
  const primaryColor = options.brandSettings.primaryColor || '#4F46E5';
  const companyName = options.brandSettings.companyName || 'AI 8D Generator';
  const date = options.metadata.date || new Date().toLocaleDateString('zh-TW');
  const version = options.metadata.version || 'v1.0';
  
  // 簡單的 markdown 轉換為 HTML
  const processedContent = convertMarkdownToHtml(options.content);
  
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(options.title)} - PDF</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm;
      
      @bottom-center {
        content: "第 " counter(page) " 頁，共 " counter(pages) " 頁";
        font-size: 9pt;
        color: #6B7280;
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #1C1917;
      background: white;
    }
    
    .report-wrapper {
      max-width: 100%;
    }
    
    /* Header */
    .report-header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%);
      color: white;
      padding: 25mm 15mm;
      margin-bottom: 8mm;
    }
    
    .report-badge {
      display: inline-block;
      background: rgba(255,255,255,0.15);
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
    }
    
    .report-title {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 5px;
    }
    
    .report-subtitle {
      font-size: 11pt;
      opacity: 0.85;
    }
    
    /* Meta Info */
    .report-meta {
      background: #F8F8FC;
      padding: 8mm 15mm;
      margin-bottom: 8mm;
      border-bottom: 1px solid #E7E5E4;
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
    }
    
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .meta-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #78716C;
    }
    
    .meta-value {
      font-size: 10pt;
      font-weight: 500;
      color: #1C1917;
    }
    
    /* Content */
    .report-content {
      padding: 0 15mm;
    }
    
    h1 {
      font-size: 16pt;
      font-weight: 700;
      margin-top: 12mm;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 2px solid ${primaryColor};
      page-break-after: avoid;
    }
    
    h2 {
      font-size: 13pt;
      font-weight: 700;
      margin-top: 10mm;
      margin-bottom: 5mm;
      padding-left: 4mm;
      border-left: 3px solid ${primaryColor};
      page-break-after: avoid;
    }
    
    h3 {
      font-size: 11pt;
      font-weight: 600;
      margin-top: 8mm;
      margin-bottom: 4mm;
      color: ${primaryColor};
      page-break-after: avoid;
    }
    
    p {
      margin-bottom: 4mm;
      text-align: justify;
      orphans: 3;
      widows: 3;
    }
    
    ul, ol {
      margin-bottom: 4mm;
      padding-left: 8mm;
    }
    
    li {
      margin-bottom: 2mm;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6mm 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    th {
      background: #F8F8FC;
      padding: 3mm 4mm;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${primaryColor};
      border-bottom: 2px solid #E7E5E4;
    }
    
    td {
      padding: 3mm 4mm;
      border-bottom: 1px solid #E7E5E4;
    }
    
    tr:hover td {
      background: #F8F8FC;
    }
    
    hr {
      height: 1px;
      background: linear-gradient(to right, transparent, #D6D3D1, transparent);
      margin: 8mm 0;
      border: none;
    }
    
    code {
      font-family: 'JetBrains Mono', monospace;
      background: #F8F8FC;
      padding: 1px 3px;
      border-radius: 2px;
      font-size: 9pt;
      color: ${primaryColor};
    }
    
    pre {
      background: #1C1917;
      color: #E2E8F0;
      padding: 5mm;
      border-radius: 4px;
      overflow-x: auto;
      margin: 5mm 0;
      font-size: 8pt;
      page-break-inside: avoid;
    }
    
    pre code {
      background: none;
      color: inherit;
      padding: 0;
    }
    
    blockquote {
      border-left: 3px solid ${primaryColor};
      background: #F8F8FC;
      padding: 4mm 6mm;
      margin: 5mm 0;
      font-style: italic;
    }
    
    blockquote p {
      margin: 0;
      color: #57534E;
      font-style: normal;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 15mm;
      padding-top: 8mm;
      border-top: 1px solid #E7E5E4;
      text-align: center;
      font-size: 8pt;
      color: #78716C;
    }
    
    .footer-brand {
      font-weight: 600;
      color: ${primaryColor};
    }
    
    /* Version Badge */
    .version-badge {
      display: inline-block;
      background: #ECFDF5;
      color: #059669;
      padding: 1px 4mm;
      border-radius: 2px;
      font-size: 8pt;
      font-weight: 600;
    }
    
    /* Print specific */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .report-header {
        break-after: page;
      }
      
      h1, h2, h3 {
        break-after: avoid;
      }
      
      table, pre, blockquote {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    <header class="report-header">
      <div class="report-badge">8D 問題解決報告</div>
      <h1 class="report-title">${escapeHtml(options.title)}</h1>
      <p class="report-subtitle">AI 驅動的根本原因分析與持續改進報告</p>
    </header>
    
    <section class="report-meta">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">報告日期</span>
          <span class="meta-value">${escapeHtml(date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">版本</span>
          <span class="meta-value"><span class="version-badge">✓ ${escapeHtml(version)}</span></span>
        </div>
        ${options.metadata.customer ? `<div class="meta-item">
          <span class="meta-label">客戶名稱</span>
          <span class="meta-value">${escapeHtml(options.metadata.customer)}</span>
        </div>` : ''}
        ${options.metadata.product ? `<div class="meta-item">
          <span class="meta-label">產品型號</span>
          <span class="meta-value">${escapeHtml(options.metadata.product)}</span>
        </div>` : ''}
      </div>
    </section>
    
    <main class="report-content">
      ${processedContent}
    </main>
    
    <footer class="report-footer">
      <p><span class="footer-brand">${escapeHtml(companyName)}</span> | 8D Problem Solving Report</p>
      <p>Version ${escapeHtml(version)} | Generated on ${escapeHtml(date)}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * 簡單的 Markdown → HTML 轉換
 */
function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let listType = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = '';
      }
      continue;
    }
    
    if (trimmed.startsWith('# ')) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ''; }
      html += `<h1>${processInline(trimmed.slice(2))}</h1>\n`;
    } else if (trimmed.startsWith('## ')) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ''; }
      html += `<h2>${processInline(trimmed.slice(3))}</h2>\n`;
    } else if (trimmed.startsWith('### ')) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ''; }
      html += `<h3>${processInline(trimmed.slice(4))}</h3>\n`;
    } else if (trimmed.match(/^[-*]\s/)) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>\n`;
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${processInline(trimmed.slice(2))}</li>\n`;
    } else if (trimmed.match(/^\d+\.\s/)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>\n`;
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${processInline(trimmed.replace(/^\d+\.\s/, ''))}</li>\n`;
    } else if (trimmed.startsWith('|')) {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ''; }
      // Table handling simplified for PDF
      html += `<p>${processInline(trimmed)}</p>\n`;
    } else {
      if (inList) { html += `</${listType}>\n`; inList = false; listType = ''; }
      html += `<p>${processInline(trimmed)}</p>\n`;
    }
  }

  if (inList) {
    html += `</${listType}>\n`;
  }

  return html;
}

/**
 * 處理行內格式
 */
function processInline(text: string): string {
  // 轉義 HTML
  text = escapeHtml(text);
  // 加粗
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜體
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 程式碼
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

/**
 * 轉義 HTML 字元
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char] || char);
}
