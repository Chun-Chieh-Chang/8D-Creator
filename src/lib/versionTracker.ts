/**
 * 報告版本追蹤系統
 * 自動生成和管理 8D 報告的版本編號
 */

export interface ReportVersion {
  version: string;        // 版本號，如 "v1.0"
  versionNumber: number;  // 主版本號
  patchNumber: number;    // 修補版本號
  timestamp: string;      // ISO 時間戳
  changelog: string[];    // 變更日誌
  author: string;         // 作者標識
}

const STORAGE_KEY = '8d_report_versions';

/**
 * 獲取當前報告的最新版本
 */
export function getLatestVersion(): ReportVersion | null {
  try {
    const versions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ReportVersion[];
    return versions.length > 0 ? versions[versions.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * 生成新版本號
 */
export function generateNewVersion(bumpType: 'major' | 'minor' | 'patch' = 'patch'): string {
  const latest = getLatestVersion();
  
  if (!latest) {
    return 'v1.0';
  }
  
  let { versionNumber, patchNumber } = latest;
  
  switch (bumpType) {
    case 'major':
      versionNumber++;
      patchNumber = 0;
      break;
    case 'minor':
      versionNumber++;
      patchNumber = 0;
      break;
    case 'patch':
      patchNumber++;
      break;
  }
  
  return `v${versionNumber}.${patchNumber}`;
}

/**
 * 保存新版本記錄
 */
export function saveVersion(version: ReportVersion): void {
  try {
    const versions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ReportVersion[];
    versions.push(version);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch (error) {
    console.error('Failed to save version:', error);
  }
}

/**
 * 創建版本記錄
 */
export function createVersionRecord(
  bumpType: 'major' | 'minor' | 'patch' = 'patch',
  changelog: string[] = [],
  author: string = 'AI Generated'
): ReportVersion {
  const version = generateNewVersion(bumpType);
  const [major, patch] = version.replace('v', '').split('.').map(Number);
  
  const record: ReportVersion = {
    version,
    versionNumber: major,
    patchNumber: patch,
    timestamp: new Date().toISOString(),
    changelog,
    author
  };
  
  saveVersion(record);
  return record;
}

/**
 * 獲取所有版本歷史
 */
export function getVersionHistory(): ReportVersion[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ReportVersion[];
  } catch {
    return [];
  }
}

/**
 * 清除版本歷史
 */
export function clearVersionHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 檢查是否為首次生成
 */
export function isFirstGeneration(): boolean {
  return getLatestVersion() === null;
}
