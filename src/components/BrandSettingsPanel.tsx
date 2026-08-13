import { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
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
    setMounted(true);
    const saved = getBrandConfig();
    if (saved) {
      setSettings({
        companyName: saved.companyName || '',
        primaryColor: saved.primaryColor || DEFAULT_SETTINGS.primaryColor,
        accentColor: saved.accentColor || DEFAULT_SETTINGS.accentColor,
        customFont: saved.customFont || DEFAULT_SETTINGS.customFont,
        watermarkText: saved.watermarkText || '',
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">品牌設定</h2>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">自訂報告外觀與識別</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          
          {/* Company Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <Building2 className="w-4 h-4" />
              公司名稱
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="例: 臺灣半導體股份有限公司"
              className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Color Presets */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">配色方案</label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.primary, preset.accent)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.primaryColor === preset.primary
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">主色</label>
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
                  className="flex-1 h-10 px-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">強調色</label>
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
                  className="flex-1 h-10 px-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Font Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <Type className="w-4 h-4" />
              字體選擇
            </label>
            <select
              value={settings.customFont}
              onChange={(e) => setSettings(prev => ({ ...prev, customFont: e.target.value }))}
              className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
          </div>

          {/* Watermark Text */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <ImageIcon className="w-4 h-4" />
              水印文字（可選）
            </label>
            <input
              type="text"
              value={settings.watermarkText}
              onChange={(e) => setSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
              placeholder="例: CONFIDENTIAL / 內部資料"
              className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
              className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
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
