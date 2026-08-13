/**
 * 品牌客製化系統
 * 允許用戶自定義 Logo、水印和品牌色系
 */

export interface BrandConfig {
  companyName: string;           // 公司名稱
  logoUrl?: string;              // Logo URL (data URL or external)
  watermarkText?: string;        // 水印文字
  primaryColor?: string;         // 主色
  accentColor?: string;          // 強調色
  customFont?: string;           // 自訂字體
}

const STORAGE_KEY = '8d_brand_config';

/**
 * 獲取品牌配置
 */
export function getBrandConfig(): BrandConfig | null {
  try {
    const config = localStorage.getItem(STORAGE_KEY);
    return config ? JSON.parse(config) : null;
  } catch {
    return null;
  }
}

/**
 * 保存品牌配置
 */
export function saveBrandConfig(config: Partial<BrandConfig>): void {
  try {
    const current = getBrandConfig() || {};
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save brand config:', error);
  }
}

/**
 * 清除品牌配置
 */
export function clearBrandConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 生成水印 SVG
 */
export function generateWatermarkSvg(text: string, color: string = '#E5E7EB'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
    <text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="${color}" 
          text-anchor="middle" dominant-baseline="middle" opacity="0.3" 
          transform="rotate(-30 200 100)">${text}</text>
  </svg>`;
}

/**
 * 將圖片轉換為 Data URL
 */
export async function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 驗證 Logo URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http') || url.startsWith('data:');
  } catch {
    return false;
  }
}
