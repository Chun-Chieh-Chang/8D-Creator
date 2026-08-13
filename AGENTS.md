<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:typescript-typecheck-rule -->
# TypeScript 型別安全檢查規則（全域）

## 推送前強制檢查流程
每次執行 `git push` 或任何推送命令**之前**，必須先執行以下檢查：

### 1. 搜尋可能的遺漏引用
```powershell
# 搜尋專案中所有 TypeScript/TSX 檔案中可能被影響的名稱
Select-String -Path "src/**/*.{ts,tsx}" -Pattern "[被修改的變量/屬性名]" | Select-Object Path, LineNumber, Line
```

### 2. 檢查 TypeScript 編譯錯誤
```bash
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

### 3. 驗證清單
- [ ] 舊的屬性/方法引用已全部更新或移除
- [ ] TypeScript 編譯錯誤為 0
- [ ] 無未使用的 import
- [ ] 修改後的邏輯流程完整

### 4. 禁止事項
❌ **不得在驗證完成前推送**
❌ **不得忽略 TypeScript 錯誤繼續操作**
❌ **不得只檢查單個檔案就推送**

## 常見觸發場景
- 變更 useState/formData 結構
- 修改 prop 介面
- 刪除函數/方法
- 重構元件

## TypeScript 嚴格模式預防規則

### 陣列方法參數類型聲明
使用 `filter()`, `map()`, `reduce()` 等陣列方法時，**必須**為回調參數添加顯式類型：

```typescript
// ❌ 錯誤 - 隱含 any 類型
const result = array.filter(item => item.condition);

// ✅ 正確 - 顯式類型聲明
const result = array.filter((item: Type) => item.condition);
```

### 其他常見規則
- **禁止** 使用 `any` 類型（除非必要）
- **要求** 所有函數參數都有明確的類型簽名
- **要求** 所有 return 值都有明確的回傳類型
<!-- END:typescript-typecheck-rule -->