import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MODEL, OFFICIAL_MODELS } from "@/lib/ai_service";
import { kbRequest } from "@/lib/knowledgeWorkspace";

interface CatalogEntry {
  provider: "agnes" | "gemini";
  source: string;
  models: string[] | null;
}

interface CatalogResult {
  providers: CatalogEntry[];
  checkedAt: string;
}

const builtIn = {
  agnes: { name: "Agnes AI", default: DEFAULT_MODEL, models: OFFICIAL_MODELS.agnes.map((model: { id: string }): string => model.id) },
  gemini: { name: "Gemini", default: DEFAULT_GEMINI_MODEL, models: OFFICIAL_MODELS.geminiFree.map((model: { id: string }): string => model.id) },
};

function compare(entry: CatalogEntry): { missing: string[]; extra: string[] } {
  const known = builtIn[entry.provider].models;
  return {
    missing: entry.models ? known.filter((model: string): boolean => !entry.models?.includes(model)) : [],
    extra: entry.models?.filter((model: string): boolean => !known.includes(model)) ?? [],
  };
}

export default function ModelCatalogNotice(): ReactNode {
  const [result, setResult] = useState<CatalogResult | null>();
  useEffect((): (() => void) => {
    const controller = new AbortController();
    void kbRequest<CatalogResult>("model-check", { signal: controller.signal })
      .then((catalog: CatalogResult): void => { if (!controller.signal.aborted) setResult(catalog); })
      .catch((): void => { if (!controller.signal.aborted) setResult(null); });
    return (): void => controller.abort();
  }, []);
  if (result === undefined) return null;
  if (result === null) return <p role="status" className="shrink-0 px-4 py-2 text-xs text-[var(--text-secondary)]">無法核對官方免費模型。請稍後重新整理。</p>;

  const needsRevision = result.providers.some((entry: CatalogEntry): boolean => compare(entry).missing.length > 0);
  const incomplete = result.providers.some((entry: CatalogEntry): boolean => entry.models === null);
  const extras = result.providers.some((entry: CatalogEntry): boolean => compare(entry).extra.length > 0);
  const title = needsRevision ? "免費模型清單有差異，請核對設定"
    : incomplete ? "部分免費模型無法核對"
    : extras ? "內建模型仍列為免費，官網另有選項" : "內建模型符合官方免費清單";

  return (
    <details open={needsRevision} className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs">
      <summary className="cursor-pointer text-[var(--text-secondary)]">{title}</summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        {result.providers.map((entry: CatalogEntry): ReactNode => {
          const { missing, extra } = compare(entry);
          const provider = builtIn[entry.provider];
          return <div key={entry.provider}>
            <p className="font-medium">{provider.name} · 預設 {provider.default}</p>
            {!entry.models ? <p>這次無法讀取免費資格。請查看官方定價。</p> : <>
              {missing.length > 0 && <p>未能確認免費資格：{missing.join("、")}。請核對官方定價。若需改用其他模型，可在 AI 設定更新。</p>}
              {extra.length > 0 && <p>官網另列免費選項：{extra.join("、")}。可在 AI 設定以自訂模型選用。</p>}
            </>}
            <a className="underline" href={entry.source} target="_blank" rel="noreferrer">官方定價</a>
          </div>;
        })}
        <p className="text-[var(--text-secondary)]">
          核對時間 {new Date(result.checkedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}。實際免費額度依帳號與專案而定。
        </p>
      </div>
    </details>
  );
}
