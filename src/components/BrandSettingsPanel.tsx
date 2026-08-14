import { useState, useEffect } from "react";
import { 
  Building2, 
  Palette, 
  Type, 
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  X
} from "lucide-react";
import { getBrandConfig, saveBrandConfig, clearBrandConfig } from "@/lib/brandConfig";

interface BrandSettings {
  companyName: string;
  primaryColor: string;
  accentColor: string;
  customFont: string;
  watermarkText: string;
}

const DEFAULT_SETTINGS: BrandSettings = {
  companyName: '',
  primaryColor: '#4F46E5',
  accentColor: '#059669',
  customFont: 'Noto Sans TC',
  watermarkText: ''
};

const FONT_OPTIONS = [
  { value: 'Noto Sans TC', label: 'Noto Sans TC' },
  { value: 'Microsoft JhengHei', label: '微軟正黑體' },
  { value: 'PingFang SC', label: 'PingFang SC' },
  { value: 'Source Han Sans', label: '思源黑體' },
];

const COLOR_PRESETS = [
  { name: '靛藍專業', primary: '#4F46E5', accent: '#059669' },
  { name: '深海藍', primary: '#1E40AF', accent: '#0891B2' },
  { name: '翡翠綠', primary: '#059669', accent: '#047857' },
  { name: '寶石紅', primary: '#DC2626', accent: '#B91C1C' },
  { name: '琥珀黃', primary: '#D97706', accent: '#B45309' },
  { name: '石墨灰', primary: '#44403C', accent: '#78716C' },
];

export default function BrandSettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const saved = getBrandConfig();
    if (saved) {
      requestAnimationFrame(() => {
        setSettings({
          companyName: saved.companyName || '',
          primaryColor: saved.primaryColor || DEFAULT_SETTINGS.primaryColor,
          accentColor: saved.accentColor || DEFAULT_SETTINGS.accentColor,
          customFont: saved.customFont || DEFAULT_SETTINGS.customFont,
          watermarkText: saved.watermarkText || '',
        });
      });
    }
  }, []);

  const handleSave = () => {
    saveBrandConfig(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    clearBrandConfig();
    setSettings(DEFAULT_SETTINGS);
  };

  const applyPreset = (primary: string, accent: string) => {
    setSettings(prev => ({ ...prev, primaryColor: primary, accentColor: accent }));
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${mounted ? 'animate-in fade-in duration-200' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/15 rounded-lg">
              <Palette className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">品牌設定</h2>
              <p className="text-[13px] text-[var(--text-secondary)]">自訂報告外觀與識別</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-base)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          
          {/* Company Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Building2 className="w-4 h-4 text-[var(--accent)]" />
              公司名稱
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="例: 臺灣半導體股份有限公司"
              className="w-full h-10 px-3 bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-80 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-all"
            />
          </div>

          {/* Color Presets */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">配色方案</label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.primary, preset.accent)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.primaryColor === preset.primary
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold'
                      : 'border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-4 h-4 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-[13px] font-medium">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)]">主色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="flex-1 h-10 px-3 bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)]">強調色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={settings.accentColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="flex-1 h-10 px-3 bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Font Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Type className="w-4 h-4 text-[var(--accent)]" />
              字體選擇
            </label>
            <select
              value={settings.customFont}
              onChange={(e) => setSettings(prev => ({ ...prev, customFont: e.target.value }))}
              className="w-full h-10 px-3 bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Watermark Text */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <ImageIcon className="w-4 h-4 text-[var(--accent)]" />
              水印文字（可選）
            </label>
            <input
              type="text"
              value={settings.watermarkText}
              onChange={(e) => setSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
              placeholder="例: CONFIDENTIAL / 內部資料"
              className="w-full h-10 px-3 bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-80 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-base)]">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            重置預設
          </button>
          
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                已儲存
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-[var(--accent)]/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
