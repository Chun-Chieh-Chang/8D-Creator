/**
 * 專業級 8D 報告 HTML 匯出器
 * 提供極致的排版、視覺效果與跨平台相容性
 */

// ==================== Types ====================

interface ReportMetadata {
  title: string;
  date: string;
  customer: string;
  product: string;
  defectQuantity: number;
  problemDescription: string;
  location: string;
}

interface TocItem {
  level: number;
  text: string;
  id: string;
}

interface ExportOptions {
  title?: string;
  metadata?: Partial<ReportMetadata>;
}

// ==================== Main Export Function ====================

export function exportToHtml(
  content: string, 
  options?: string | ExportOptions,
  fallbackMetadata?: Partial<ReportMetadata>
): void {
  let opt: ExportOptions = {};
  
  if (typeof options === 'string') {
    opt = { title: options };
  } else if (options) {
    opt = options;
  }
  
  if (fallbackMetadata) {
    opt.metadata = { ...opt.metadata, ...fallbackMetadata };
  }
  
  const { title = "8D Problem Solving Report", metadata: optsMetadata = {} } = opt;
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}_${timestamp}.html`;
  
  const parsedMeta = parseMetadata(content, optsMetadata);
  const processedContent = processMarkdown(content);
  const tableOfContents = extractToc(processedContent);
  
  const htmlContent = generateHtmlDocument({
    title,
    metadata: parsedMeta,
    content: processedContent,
    toc: tableOfContents,
    generatedDate: timestamp
  });
  
  triggerDownload(htmlContent, filename);
}

// ==================== Metadata Parsing ====================

function parseMetadata(markdown: string, fallback: Partial<ReportMetadata>): ReportMetadata {
  const lines = markdown.split('\n');
  const meta: Partial<ReportMetadata> = {};
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
      meta.date = trimmed;
    }
    
    if (/^(客戶|Customer).*[:：]/i.test(trimmed)) {
      meta.customer = trimmed.replace(/^(客戶|Customer).*[:：]\s*/, '');
    }
    
    if (/^(產品|Product|型號).*[:：]/i.test(trimmed)) {
      meta.product = trimmed.replace(/^(產品|Product|型號).*[:：]\s*/, '');
    }
    
    if (/^不良數.*(量)?[:：]/i.test(trimmed)) {
      const match = trimmed.match(/(\d+)/);
      if (match) meta.defectQuantity = parseInt(match[1], 10);
    }
    
    if (/^(發生地點|Location).*[:：]/i.test(trimmed)) {
      meta.location = trimmed.replace(/^(發生地點|Location).*[:：]\s*/, '');
    }
  });
  
  return {
    title: fallback.title || meta.title || '未命名報告',
    date: fallback.date || meta.date || new Date().toLocaleDateString('zh-TW'),
    customer: fallback.customer || meta.customer || '待填寫',
    product: fallback.product || meta.product || '待填寫',
    defectQuantity: fallback.defectQuantity || meta.defectQuantity || 0,
    problemDescription: fallback.problemDescription || meta.problemDescription || '',
    location: fallback.location || meta.location || '待填寫'
  };
}

// ==================== Markdown Processing ====================

function processMarkdown(markdown: string): string {
  let processed = markdown;
  
  // Auto-number 8D sections
  processed = processed.replace(/^## (問題描述)/gm, '## D1 問題描述');
  processed = processed.replace(/^## (使用工具描繪問題)/gm, '## D2 使用工具描繪問題');
  processed = processed.replace(/^## (團隊建立)/gm, '## D3 團隊建立');
  processed = processed.replace(/^## (根本原因分析)/gm, '## D4 根本原因分析');
  processed = processed.replace(/^## (矯正措施)/gm, '## D5 矯正措施');
  processed = processed.replace(/^## (預防再發)/gm, '## D6 預防再發');
  processed = processed.replace(/^## (驗證措施有效性)/gm, '## D7 驗證措施有效性');
  processed = processed.replace(/^## (表揚團隊)/gm, '## D8 表揚團隊');
  processed = processed.replace(/^## (持續改進)/gm, '## D9 持續改進');
  
  return convertMarkdownToHtml(processed);
}

function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  
  let currentListType = '';
  let currentTableRows: string[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLang = '';

  const closeCurrentList = () => {
    if (currentListType) {
      result.push(`</${currentListType}>`);
      currentListType = '';
    }
  };

  const closeCurrentTable = () => {
    if (currentTableRows.length > 0) {
      result.push(renderTable(currentTableRows));
      currentTableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeContent = [];
      } else {
        result.push(renderCodeBlock(codeContent.join('\n'), codeLang));
        inCodeBlock = false;
        codeContent = [];
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(trimmed);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      closeCurrentTable();
      closeCurrentList();
      continue;
    }

    // Tables
    if (trimmed.startsWith('|')) {
      closeCurrentList();
      currentTableRows.push(trimmed);
      continue;
    }
    if (currentTableRows.length > 0) {
      result.push(renderTable(currentTableRows));
      currentTableRows = [];
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      result.push(`<h1>${processInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      result.push(`<h2 id="${generateId(trimmed)}">${processInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      result.push(`<h3 id="${generateId(trimmed)}">${processInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      result.push(`<h4 id="${generateId(trimmed)}">${processInline(trimmed.slice(5))}</h4>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      result.push('<hr class="divider">');
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      result.push(`<blockquote>${processInline(trimmed.slice(1).trim())}</blockquote>`);
      continue;
    }

    // Unordered lists
    if (/^[-*+]\s/.test(trimmed)) {
      if (currentListType !== 'ul') {
        closeCurrentList();
        result.push('<ul class="bullet-list">');
        currentListType = 'ul';
      }
      result.push(`<li>${processInline(trimmed.replace(/^[-*+]\s/, ''))}</li>`);
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s/.test(trimmed)) {
      if (currentListType !== 'ol') {
        closeCurrentList();
        result.push('<ol class="numbered-list">');
        currentListType = 'ol';
      }
      result.push(`<li>${processInline(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // Paragraph
    closeCurrentList();
    result.push(`<p>${processInline(trimmed)}</p>`);
  }

  // Close any remaining structures
  closeCurrentTable();
  closeCurrentList();

  return result.join('\n');
}

// ==================== Table Rendering ====================

function renderTable(rows: string[]): string {
  if (rows.length === 0) return '';
  
  const headerCells = rows[0]
    .split('|')
    .filter((c: string) => c.trim())
    .map((c: string) => c.trim());
  
  let html = '<table class="professional-table">\n<thead>\n<tr>';
  headerCells.forEach((cell: string) => {
    html += `<th>${processInline(cell)}</th>`;
  });
  html += '</tr>\n</thead>\n<tbody>';
  
  for (let i = 2; i < rows.length; i++) {
    const cells = rows[i].split('|').filter((c: string) => c.trim()).map((c: string) => c.trim());
    if (cells.length === 0) continue;
    
    html += '<tr>';
    cells.forEach((cell: string) => {
      html += `<td>${processInline(cell)}</td>`;
    });
    html += '</tr>';
  }
  
  html += '</tbody>\n</table>';
  return html;
}

// ==================== Code Block Rendering ====================

function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const languageBadge = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
  return `<div class="code-block">\n${languageBadge}\n<pre><code>${escaped}</code></pre>\n</div>`;
}

// ==================== Inline Formatting ====================

function processInline(text: string): string {
  text = escapeHtml(text);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

// ==================== TOC Generation ====================

function extractToc(html: string): TocItem[] {
  const headings = html.match(/<h([23])>([^<]+)<\/h\1>/g) || [];
  return headings.map((h: string) => {
    const match = h.match(/<h(\d)>([^<]+)<\/h\1>/);
    if (match) {
      return {
        level: parseInt(match[1], 10),
        text: match[2].trim(),
        id: generateIdFromText(match[2])
      };
    }
    return null;
  }).filter((item: TocItem | null): item is TocItem => item !== null);
}

// ==================== Utilities ====================

function generateId(line: string): string {
  return generateIdFromText(line.replace(/^#+\s*/, ''));
}

function generateIdFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char: string) => map[char] || char);
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== HTML Document Generator ====================

interface DocOptions {
  title: string;
  metadata: ReportMetadata;
  content: string;
  toc: TocItem[];
  generatedDate: string;
}

function generateHtmlDocument(options: DocOptions): string {
  const { title, metadata, content, toc, generatedDate } = options;
  
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="8D Problem Solving Report - ${escapeHtml(title)}">
  <meta name="generator" content="AI 8D Generator">
  <title>${escapeHtml(title)} | 8D 報告</title>
  
  <!-- Premium Typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    /* ============================================
       8D REPORT PREMIUM STYLESHEET
       Color System: Indigo Professional Theme
    ============================================ */
    
    :root {
      /* Primary Palette */
      --color-primary-50: #EEF2FF;
      --color-primary-100: #E0E7FF;
      --color-primary-200: #C7D2FE;
      --color-primary-300: #A5B4FC;
      --color-primary-400: #818CF8;
      --color-primary-500: #6366F1;
      --color-primary-600: #4F46E5;
      --color-primary-700: #4338CA;
      --color-primary-800: #3730A3;
      --color-primary-900: #312E81;
      
      /* Semantic Colors */
      --color-success: #059669;
      --color-success-light: #ECFDF5;
      --color-warning: #D97706;
      --color-warning-light: #FFFBEB;
      --color-danger: #DC2626;
      --color-danger-light: #FEF2F2;
      --color-info: #0891B2;
      --color-info-light: #ECFEFF;
      
      /* Neutrals */
      --color-neutral-50: #FAFAF9;
      --color-neutral-100: #F5F5F4;
      --color-neutral-200: #E7E5E4;
      --color-neutral-300: #D6D3D1;
      --color-neutral-400: #A8A29E;
      --color-neutral-500: #78716C;
      --color-neutral-600: #57534E;
      --color-neutral-700: #44403C;
      --color-neutral-800: #292524;
      --color-neutral-900: #1C1917;
      
      /* Background System */
      --bg-page: var(--color-neutral-50);
      --bg-card: #FFFFFF;
      --bg-subtle: var(--color-primary-50);
      --bg-elevated: var(--color-neutral-100);
      
      /* Text System */
      --text-primary: var(--color-neutral-900);
      --text-secondary: var(--color-neutral-600);
      --text-muted: var(--color-neutral-500);
      --text-inverse: #FFFFFF;
      
      /* Border System */
      --border-subtle: var(--color-neutral-200);
      --border-default: var(--color-neutral-300);
      --border-strong: var(--color-neutral-400);
      
      /* Shadow System */
      --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      
      /* Typography */
      --font-sans: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
      
      /* Spacing */
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-5: 1.25rem;
      --space-6: 1.5rem;
      --space-8: 2rem;
      --space-10: 2.5rem;
      --space-12: 3rem;
      --space-16: 4rem;
      
      /* Layout */
      --max-width: 900px;
      --sidebar-width: 260px;
      
      /* Transitions */
      --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
      --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
      --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      :root {
        --color-primary-50: #1E1B4B;
        --color-primary-600: #818CF8;
        --color-primary-700: #A5B4FC;
        
        --color-neutral-50: #09090B;
        --color-neutral-100: #18181B;
        --color-neutral-200: #27272A;
        --color-neutral-300: #3F3F46;
        --color-neutral-400: #71717A;
        --color-neutral-500: #A1A1AA;
        --color-neutral-600: #D4D4D8;
        --color-neutral-700: #E4E4E7;
        --color-neutral-800: #FAFAF9;
        --color-neutral-900: #FFFFFF;
        
        --bg-page: var(--color-neutral-50);
        --bg-card: var(--color-neutral-100);
        --bg-subtle: var(--color-primary-50);
        --bg-elevated: var(--color-neutral-200);
        
        --text-primary: var(--color-neutral-800);
        --text-secondary: var(--color-neutral-400);
        --text-muted: var(--color-neutral-500);
        
        --border-subtle: var(--color-neutral-800);
        --border-default: var(--color-neutral-700);
        
        --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
        --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
        --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
      }
    }
    
    .dark {
      --color-primary-50: #1E1B4B;
      --color-primary-600: #818CF8;
      --color-primary-700: #A5B4FC;
      
      --color-neutral-50: #09090B;
      --color-neutral-100: #18181B;
      --color-neutral-200: #27272A;
      --color-neutral-300: #3F3F46;
      --color-neutral-400: #71717A;
      --color-neutral-500: #A1A1AA;
      --color-neutral-600: #D4D4D8;
      --color-neutral-700: #E4E4E7;
      --color-neutral-800: #FAFAF9;
      --color-neutral-900: #FFFFFF;
      
      --bg-page: var(--color-neutral-50);
      --bg-card: var(--color-neutral-100);
      --bg-subtle: var(--color-primary-50);
      --bg-elevated: var(--color-neutral-200);
      
      --text-primary: var(--color-neutral-800);
      --text-secondary: var(--color-neutral-400);
      --text-muted: var(--color-neutral-500);
      
      --border-subtle: var(--color-neutral-800);
      --border-default: var(--color-neutral-700);
      
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
      --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
    }
    
    /* Reset & Base */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
    
    body {
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.75;
      color: var(--text-primary);
      background-color: var(--bg-page);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    .report-container {
      max-width: var(--max-width);
      margin: 0 auto;
      background: var(--bg-card);
      min-height: 100vh;
      box-shadow: var(--shadow-lg);
    }
    
    /* Header */
    .report-header {
      position: relative;
      background: linear-gradient(135deg, 
        var(--color-primary-600) 0%, 
        var(--color-primary-700) 50%,
        var(--color-primary-800) 100%
      );
      color: var(--text-inverse);
      padding: var(--space-16) var(--space-12);
      overflow: hidden;
    }
    
    .report-header::before,
    .report-header::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    
    .report-header::before {
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%);
    }
    
    .report-header::after {
      bottom: -30%;
      left: -10%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%);
    }
    
    .header-content {
      position: relative;
      z-index: 1;
      max-width: calc(var(--max-width) - var(--space-12) * 2);
      margin: 0 auto;
    }
    
    .report-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: var(--space-2) var(--space-4);
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: var(--space-6);
    }
    
    .report-badge svg { width: 14px; height: 14px; opacity: 0.9; }
    
    .report-title {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: var(--space-3);
      text-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .report-subtitle {
      font-size: 1.05rem;
      font-weight: 400;
      opacity: 0.85;
    }
    
    /* Meta Section */
    .report-meta {
      padding: var(--space-8) var(--space-12);
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-5);
      max-width: calc(var(--max-width) - var(--space-12) * 2);
      margin: 0 auto;
    }
    
    .meta-item { display: flex; flex-direction: column; gap: var(--space-1); }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
    }
    .meta-value {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.4;
    }
    
    /* Body Layout */
    .report-body {
      display: grid;
      grid-template-columns: 1fr;
      max-width: var(--max-width);
      margin: 0 auto;
    }
    
    @media (min-width: 1024px) {
      .report-body { grid-template-columns: var(--sidebar-width) 1fr; }
    }
    
    /* TOC Sidebar */
    .toc-sidebar {
      padding: var(--space-8) var(--space-6);
      border-right: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      height: fit-content;
      max-height: calc(100vh - 2rem);
      overflow-y: auto;
    }
    
    @media (max-width: 1023px) {
      .toc-sidebar {
        border-right: none;
        border-bottom: 1px solid var(--border-subtle);
        position: relative;
        height: auto;
        max-height: 200px;
      }
    }
    
    .toc-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-3);
      border-bottom: 2px solid var(--border-subtle);
    }
    
    .toc-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1); }
    
    .toc-link {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: 6px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      transition: all var(--transition-fast);
    }
    
    .toc-link:hover { background: var(--bg-subtle); color: var(--color-primary-600); }
    
    .toc-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      font-size: 10px;
      font-weight: 700;
      color: var(--color-primary-600);
      background: var(--color-primary-100);
      border-radius: 4px;
      flex-shrink: 0;
    }
    
    /* Content */
    .report-content { padding: var(--space-12); }
    @media (max-width: 1023px) { .report-content { padding: var(--space-8); } }
    
    /* Typography */
    h1, h2, h3, h4 {
      font-family: var(--font-sans);
      font-weight: 700;
      line-height: 1.3;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }
    
    h1 {
      font-size: 2rem;
      margin-top: 0;
      margin-bottom: var(--space-6);
      padding-bottom: var(--space-3);
      border-bottom: 3px solid var(--color-primary-600);
    }
    
    h2 {
      font-size: 1.5rem;
      margin-top: var(--space-10);
      margin-bottom: var(--space-4);
      padding-left: var(--space-4);
      border-left: 4px solid var(--color-primary-600);
      scroll-margin-top: 2rem;
    }
    
    h3 {
      font-size: 1.25rem;
      margin-top: var(--space-6);
      margin-bottom: var(--space-3);
      color: var(--color-primary-700);
      scroll-margin-top: 1.5rem;
    }
    
    h4 {
      font-size: 1.1rem;
      margin-top: var(--space-5);
      margin-bottom: var(--space-2);
      color: var(--text-secondary);
      scroll-margin-top: 1rem;
    }
    
    p { margin-bottom: var(--space-4); text-align: justify; hyphens: auto; }
    
    /* Lists */
    ul.bullet-list, ol.numbered-list {
      margin-bottom: var(--space-4);
      padding-left: var(--space-6);
    }
    
    ul.bullet-list li, ol.numbered-list li {
      margin-bottom: var(--space-2);
      position: relative;
    }
    
    ul.bullet-list li::marker { color: var(--color-primary-600); font-size: 1.2em; }
    ol.numbered-list li::marker { color: var(--color-primary-600); font-weight: 700; }
    
    /* Tables */
    table.professional-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: var(--space-6) 0;
      font-size: 14px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }
    
    table.professional-table th {
      background: var(--bg-subtle);
      padding: var(--space-3) var(--space-4);
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-primary-700);
      border-bottom: 2px solid var(--border-default);
    }
    
    table.professional-table td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: top;
    }
    
    table.professional-table tbody tr:hover td { background: var(--bg-subtle); }
    table.professional-table tbody tr:last-child td { border-bottom: none; }
    
    /* Code Blocks */
    pre {
      background: var(--color-neutral-900);
      color: #E2E8F0;
      padding: var(--space-5);
      border-radius: 8px;
      overflow-x: auto;
      margin: var(--space-5) 0;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.6;
    }
    
    pre code { font-family: inherit; background: none; padding: 0; color: inherit; font-size: inherit; }
    
    .code-block { position: relative; margin: var(--space-5) 0; }
    
    .code-lang {
      position: absolute;
      top: 0;
      right: 0;
      padding: var(--space-1) var(--space-3);
      background: var(--color-neutral-800);
      color: var(--color-neutral-400);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border-radius: 0 8px 0 8px;
    }
    
    code {
      font-family: var(--font-mono);
      background: var(--bg-subtle);
      color: var(--color-primary-700);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
      font-weight: 500;
    }
    
    /* Blockquote */
    blockquote {
      border-left: 4px solid var(--color-primary-600);
      background: var(--bg-subtle);
      padding: var(--space-4) var(--space-6);
      margin: var(--space-5) 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }
    
    blockquote p { margin: 0; color: var(--text-secondary); font-style: normal; }
    
    /* Divider */
    hr.divider {
      border: none;
      height: 2px;
      background: linear-gradient(to right, transparent, var(--border-default), transparent);
      margin: var(--space-10) 0;
    }
    
    /* Badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .badge-high { background: var(--color-danger-light); color: var(--color-danger); }
    .badge-medium { background: var(--color-warning-light); color: var(--color-warning); }
    .badge-low { background: var(--color-success-light); color: var(--color-success); }
    .badge-info { background: var(--color-info-light); color: var(--color-info); }
    
    /* Footer */
    .report-footer {
      padding: var(--space-8) var(--space-12);
      background: var(--bg-subtle);
      border-top: 1px solid var(--border-subtle);
      text-align: center;
    }
    
    .footer-brand { font-weight: 700; color: var(--color-primary-600); font-size: 14px; }
    .footer-text { font-size: 12px; color: var(--text-muted); margin-top: var(--space-2); }
    
    /* Print Styles */
    @media print {
      @page { size: A4; margin: 15mm 10mm; }
      html, body { background: white !important; color: #1a1a1a !important; font-size: 11pt; }
      .report-container { max-width: 100%; box-shadow: none; }
      .report-header { padding: 20mm 15mm; background: var(--color-primary-700) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-meta { padding: 8mm 15mm; }
      .report-content { padding: 10mm 15mm; }
      .toc-sidebar { display: none; }
      .report-body { grid-template-columns: 1fr !important; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      p, li, td { page-break-inside: avoid; }
      pre, table { page-break-inside: avoid; }
      a { color: var(--color-primary-700); text-decoration: none; }
      a[href]::after { content: none; }
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .report-content > * { animation: fadeIn 0.4s ease-out forwards; }
    .report-content > *:nth-child(1) { animation-delay: 0.05s; }
    .report-content > *:nth-child(2) { animation-delay: 0.1s; }
    .report-content > *:nth-child(3) { animation-delay: 0.15s; }
    .report-content > *:nth-child(4) { animation-delay: 0.2s; }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
    
    /* Responsive */
    @media (max-width: 640px) {
      :root { --space-12: 1.5rem; --space-8: 1rem; }
      .report-header { padding: var(--space-8) var(--space-6); }
      .report-meta { padding: var(--space-6); }
      .meta-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
      .report-content { padding: var(--space-6); }
      h1 { font-size: 1.75rem; }
      h2 { font-size: 1.375rem; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    
    <header class="report-header">
      <div class="header-content">
        <div class="report-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
          <span class="meta-value">${escapeHtml(metadata.date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">客戶名稱</span>
          <span class="meta-value">${escapeHtml(metadata.customer)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">產品型號</span>
          <span class="meta-value">${escapeHtml(metadata.product)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">不良數量</span>
          <span class="meta-value">${metadata.defectQuantity || '—'} pcs</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">發生地點</span>
          <span class="meta-value">${escapeHtml(metadata.location)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">生成方式</span>
          <span class="meta-value">AI 協作分析</span>
        </div>
      </div>
    </section>
    
    <div class="report-body">
      
      <aside class="toc-sidebar">
        <div class="toc-title">目錄</div>
        <nav>
          <ul class="toc-list">
            ${toc.length > 0 
              ? toc.map((item: TocItem, index: number) => `
              <li class="toc-item">
                <a href="#${item.id}" class="toc-link" style="padding-left: ${item.level === 3 ? '1.25rem' : '0.75rem'}">
                  <span class="toc-number">${index + 1}</span>
                  <span>${escapeHtml(item.text)}</span>
                </a>
              </li>`).join('\n')
              : '<li class="toc-item"><span style="color: var(--text-muted); font-size: 13px;">暫無目錄</span></li>'
            }
          </ul>
        </nav>
      </aside>
      
      <main class="report-content">
        ${content}
      </main>
      
    </div>
    
    <footer class="report-footer">
      <p><span class="footer-brand">AI 8D Generator</span> | 8D Problem Solving Report</p>
      <p class="footer-text">Generated on ${generatedDate} | Professional Quality Management Tool</p>
    </footer>
    
  </div>
  
  <script>
    document.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', function(e: MouseEvent) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  </script>
</body>
</html>`;
}
