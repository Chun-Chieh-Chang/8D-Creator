/**
 * 專業級 8D 報告 HTML 匯出器（進階版）
 * 支援版本追蹤、品牌客製化、PDF 品質輸出
 */

import { createVersionRecord } from './versionTracker';
import { getBrandConfig } from './brandConfig';

// ==================== Types ====================

interface ReportMetadata {
  title: string;
  date: string;
  customer: string;
  product: string;
  productBatch: string;
  defectQuantity: number;
  problemDescription: string;
  location: string;
}

interface TocItem {
  level: number;
  text: string;
  id: string;
}

interface BrandSettings {
  companyName?: string;
  logoUrl?: string;
  watermarkText?: string;
  primaryColor?: string;
  accentColor?: string;
}

interface ExportOptions {
  title?: string;
  metadata?: Partial<ReportMetadata>;
  bumpVersion?: 'major' | 'minor' | 'patch';
  changelog?: string[];
  brandSettings?: BrandSettings;
}

// ==================== Main Export Function ====================

export function exportToHtml(
  content: string, 
  options: ExportOptions = {}
): void {
  const {
    title = "8D Problem Solving Report",
    metadata: optsMetadata = {},
    bumpVersion = 'patch',
    changelog = [],
    brandSettings = {}
  } = options;
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}_${timestamp}.html`;
  
  // 解析元數據
  const parsedMeta = parseMetadata(content, optsMetadata);
  
  // 生成並保存版本記錄
  const versionRecord = createVersionRecord(bumpVersion, changelog);
  
  // 處理 Markdown
  const processedContent = processMarkdown(content);
  const tableOfContents = extractToc(processedContent);
  
  // 合併品牌設定
  const brandConfig = getBrandConfig();
  const finalBrandSettings = { ...brandConfig, ...brandSettings };
  
  // 生成 HTML
  const htmlContent = generateHtmlDocument({
    title,
    metadata: parsedMeta,
    content: processedContent,
    toc: tableOfContents,
    generatedDate: timestamp,
    version: versionRecord.version,
    brandSettings: finalBrandSettings
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
    
    if (/^(產品批號|Product Batch).*[:：]/i.test(trimmed)) {
      meta.productBatch = trimmed.replace(/^(產品批號|Product Batch).*[:：]\s*/, '');
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
    productBatch: fallback.productBatch || meta.productBatch || '待填寫',
    defectQuantity: fallback.defectQuantity || meta.defectQuantity || 0,
    problemDescription: fallback.problemDescription || meta.problemDescription || '',
    location: fallback.location || meta.location || '待填寫'
  };
}

// ==================== Markdown Processing ====================

function processMarkdown(markdown: string): string {
  let processed = markdown;
  
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

    if (!trimmed) {
      closeCurrentTable();
      closeCurrentList();
      continue;
    }

    if (trimmed.startsWith('|')) {
      closeCurrentList();
      currentTableRows.push(trimmed);
      continue;
    }
    if (currentTableRows.length > 0) {
      result.push(renderTable(currentTableRows));
      currentTableRows = [];
    }

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

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      result.push('<hr class="divider">');
      continue;
    }

    if (trimmed.startsWith('>')) {
      result.push(`<blockquote>${processInline(trimmed.slice(1).trim())}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      if (currentListType !== 'ul') {
        closeCurrentList();
        result.push('<ul class="bullet-list">');
        currentListType = 'ul';
      }
      result.push(`<li>${processInline(trimmed.replace(/^[-*+]\s/, ''))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (currentListType !== 'ol') {
        closeCurrentList();
        result.push('<ol class="numbered-list">');
        currentListType = 'ol';
      }
      result.push(`<li>${processInline(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    closeCurrentList();
    result.push(`<p>${processInline(trimmed)}</p>`);
  }

  closeCurrentTable();
  closeCurrentList();

  return result.join('\n');
}

// ==================== Table & Code Rendering ====================

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

function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const languageBadge = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
  return `<div class="code-block">\n${languageBadge}\n<pre><code>${escaped}</code></pre>\n</div>`;
}

// ==================== Inline Formatting & Utilities ====================

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
  version: string;
  brandSettings: BrandSettings;
}

function generateHtmlDocument(options: DocOptions): string {
  const { title, metadata, content, toc, generatedDate, version, brandSettings } = options;
  
  // 品牌色設定
  const primaryColor = brandSettings.primaryColor || '#4F46E5';
  const accentColor = brandSettings.accentColor || '#059669';
  
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="8D Problem Solving Report - ${escapeHtml(title)}">
  <meta name="generator" content="AI 8D Generator">
  <title>${escapeHtml(title)} | ${version}</title>
  
  <!-- Premium Typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root {
      /* Brand Colors */
      --color-brand-primary: ${primaryColor};
      --color-brand-accent: ${accentColor};
      
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
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --color-primary-50: #1E1B4B;
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
        
        --text-primary: var(--color-neutral-800);
        --text-secondary: var(--color-neutral-400);
        --text-muted: var(--color-neutral-500);
        
        --border-subtle: var(--color-neutral-800);
        --border-default: var(--color-neutral-700);
      }
    }
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    
    body {
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.75;
      color: var(--text-primary);
      background: var(--bg-page);
      -webkit-font-smoothing: antialiased;
    }
    
    .report-container {
      max-width: var(--max-width);
      margin: 0 auto;
      background: var(--bg-card);
      min-height: 100vh;
      box-shadow: var(--shadow-lg);
    }
    
    /* Header with Brand Color */
    .report-header {
      position: relative;
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%);
      color: var(--text-inverse);
      padding: var(--space-16) var(--space-12);
      overflow: hidden;
    }
    
    .report-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%);
      border-radius: 50%;
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
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: var(--space-2) var(--space-4);
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: var(--space-6);
    }
    
    .report-title {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: var(--space-3);
    }
    
    .report-subtitle {
      font-size: 1.05rem;
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
    
    .toc-link:hover { background: var(--bg-subtle); color: var(--color-brand-primary); }
    
    .toc-number {
      width: 20px;
      height: 20px;
      font-size: 10px;
      font-weight: 700;
      color: var(--color-brand-primary);
      background: var(--color-primary-100);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Content */
    .report-content { padding: var(--space-12); }
    @media (max-width: 1023px) { .report-content { padding: var(--space-8); } }
    
    /* Typography */
    h1 { font-size: 2rem; margin-bottom: var(--space-6); padding-bottom: var(--space-3); border-bottom: 3px solid ${primaryColor}; }
    h2 {
      font-size: 1.5rem;
      margin-top: var(--space-10);
      margin-bottom: var(--space-4);
      padding-left: var(--space-4);
      border-left: 4px solid ${primaryColor};
      scroll-margin-top: 2rem;
    }
    h3 { font-size: 1.25rem; margin-top: var(--space-6); margin-bottom: var(--space-3); color: ${primaryColor}; }
    h4 { font-size: 1.1rem; margin-top: var(--space-5); margin-bottom: var(--space-2); color: var(--text-secondary); }
    p { margin-bottom: var(--space-4); text-align: justify; }
    
    /* Lists */
    ul.bullet-list, ol.numbered-list { margin-bottom: var(--space-4); padding-left: var(--space-6); }
    ul.bullet-list li::marker { color: ${primaryColor}; }
    ol.numbered-list li::marker { color: ${primaryColor}; font-weight: 700; }
    
    /* Tables */
    table.professional-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: var(--space-6) 0;
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
      color: ${primaryColor};
      border-bottom: 2px solid var(--border-default);
    }
    table.professional-table td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-subtle); }
    table.professional-table tbody tr:hover td { background: var(--bg-subtle); }
    
    /* Code Blocks */
    pre {
      background: var(--color-neutral-900);
      color: #E2E8F0;
      padding: var(--space-5);
      border-radius: 8px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 13px;
    }
    code {
      font-family: var(--font-mono);
      background: var(--bg-subtle);
      color: ${primaryColor};
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
    }
    
    /* Blockquote */
    blockquote {
      border-left: 4px solid ${primaryColor};
      background: var(--bg-subtle);
      padding: var(--space-4) var(--space-6);
      margin: var(--space-5) 0;
      border-radius: 0 8px 8px 0;
    }
    
    /* Divider */
    hr.divider {
      height: 2px;
      background: linear-gradient(to right, transparent, var(--border-default), transparent);
      margin: var(--space-10) 0;
      border: none;
    }
    
    /* Version Badge */
    .version-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: var(--color-success-light);
      color: var(--color-success);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    /* Footer with Brand */
    .report-footer {
      padding: var(--space-8) var(--space-12);
      background: var(--bg-subtle);
      border-top: 1px solid var(--border-subtle);
      text-align: center;
    }
    
    .footer-brand { font-weight: 700; color: ${primaryColor}; font-size: 14px; }
    .footer-text { font-size: 12px; color: var(--text-muted); margin-top: var(--space-2); }
    
    /* Print Styles */
    @media print {
      @page { size: A4; margin: 15mm 10mm; }
      html, body { background: white !important; font-size: 11pt; }
      .report-container { max-width: 100%; box-shadow: none; }
      .report-header { background: ${primaryColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toc-sidebar { display: none; }
      .report-body { grid-template-columns: 1fr !important; }
      h1, h2, h3 { page-break-after: avoid; }
      p, li, td { page-break-inside: avoid; }
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .report-content > * { animation: fadeIn 0.4s ease-out forwards; }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 3px; }
    
    /* Responsive */
    @media (max-width: 640px) {
      :root { --space-12: 1.5rem; --space-8: 1rem; }
      .report-header { padding: var(--space-8) var(--space-6); }
      .report-meta { padding: var(--space-6); }
      .meta-grid { grid-template-columns: repeat(2, 1fr); }
      .report-content { padding: var(--space-6); }
      h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    
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
          <span class="meta-value">${escapeHtml(metadata.date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">版本</span>
          <span class="meta-value"><span class="version-badge">✓ ${version}</span></span>
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
          <span class="meta-label">產品批號</span>
          <span class="meta-value">${escapeHtml(metadata.productBatch)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">不良數量</span>
          <span class="meta-value">${metadata.defectQuantity || '—'} pcs</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">發生地點</span>
          <span class="meta-value">${escapeHtml(metadata.location)}</span>
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
      <p><span class="footer-brand">${brandSettings.companyName || 'AI 8D Generator'}</span> | 8D Problem Solving Report</p>
      <p class="footer-text">Version ${version} | Generated on ${generatedDate} | Professional Quality Management Tool</p>
    </footer>
    
  </div>
  
  <script>
    document.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', function(e) {
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
