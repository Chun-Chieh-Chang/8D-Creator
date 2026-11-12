import type { MapDestination } from "./ProjectMap";

export type FlowGroup = "intake" | "case" | "report" | "output";
export type Side = "top" | "bottom" | "left" | "right";
type Point = [number, number];

export const flowLayout = {
  nodeWidth: 168,
  nodeHeight: 64,
  edgeClearance: 20,
  arrowGap: 2,
  canvasPadding: 12,
} as const;

export interface FlowNode {
  id: string;
  name: string;
  caption: string;
  group: FlowGroup;
  position: Point;
  input: string;
  output: string;
  description: string;
  action?: [MapDestination, string];
  local?: true;
  decision?: true;
}

export interface FlowEdge {
  from: string;
  to: string;
  sides: [Side, Side];
  via?: Point[];
  label?: [string, number, number];
}

const rightmostNodeX = 860;
const rightChannel = rightmostNodeX + flowLayout.nodeWidth + flowLayout.edgeClearance + 8;

export const groups: Record<FlowGroup, { name: string; x: number; width: number; color: string }> = {
  intake: { name: "資料來源", x: 12, width: 200, color: "#15805d" },
  case: { name: "案件列管", x: 220, width: 200, color: "#2b69b1" },
  report: { name: "8D 報告", x: 428, width: 408, color: "#8052b4" },
  output: { name: "報告結果與檔案", x: 844, width: rightChannel - 844 + flowLayout.canvasPadding, color: "#a76618" },
};

export const canvasWidth = groups.output.x + groups.output.width + flowLayout.canvasPadding;

export const nodes: FlowNode[] = [
  {
    id: "source", name: "同步既有案件", caption: "歷史資料夾與附件", group: "intake", position: [28, 76], local: true,
    input: "異常案件資料夾及其檔案。",
    output: "案件索引、附件連結及未歸檔來源。",
    description: "在案件工作區選取「同步案件」。系統掃描來源，並更新知識庫索引。",
    action: ["search", "開啟案件工作區"],
  },
  {
    id: "new", name: "新增案件", caption: "廠內、供應商、客戶", group: "intake", position: [28, 186], local: true,
    input: "來源類別、發生日期和案件名稱。",
    output: "案件 ID 和案件記錄。",
    description: "建立案件後，可開啟該案件並匯入證據附件。",
    action: ["new", "新增案件"],
  },
  {
    id: "search", name: "搜尋案件", caption: "依品號、缺陷或單號查找", group: "intake", position: [28, 296], local: true,
    input: "品號、缺陷、案件 ID 或 NCA 單號。",
    output: "符合條件的案件清單。",
    description: "選取案件以查看原始證據、列管狀態和既有草稿。",
    action: ["search", "搜尋案件"],
  },
  {
    id: "case", name: "開啟與複核案件", caption: "證據、摘要與缺陷", group: "case", position: [236, 186], local: true,
    input: "案件記錄、來源檔案和匯入的附件。",
    output: "可回查來源的案件摘要、缺陷與複核記錄。",
    description: "確認已有證據。補填可確認的資料，並儲存複核結果。",
    action: ["search", "選取案件"],
  },
  {
    id: "decision", name: "判定 NCA 狀態", caption: "依廠內規範判定", group: "case", position: [236, 306], local: true, decision: true,
    input: "案件證據與廠內不合格品管制規範。",
    output: "待判定、僅供參考、需開立或已開立。",
    description: "由人員選擇並儲存列管狀態。案件可依需要製作 8D 報告。",
    action: ["nca", "前往 NCA 列管"],
  },
  {
    id: "reference", name: "僅供參考", caption: "保留於案件清單", group: "case", position: [28, 436], local: true,
    input: "已判定僅供參考的案件。",
    output: "可搜尋、補件與製作 8D 報告的參考案件。",
    description: "將 NCA 狀態設為「僅供參考」。系統繼續保留該案件。",
    action: ["nca", "前往 NCA 列管"],
  },
  {
    id: "nca", name: "列管通知單", caption: "單號、進度、期限與 CAPA", group: "case", position: [236, 436], local: true,
    input: "需開立或已開立的案件及通知單資料。",
    output: "通知單狀態、單號及已記錄的進度、期限與 CAPA 資料。",
    description: "依廠內流程處理通知單。將已確認的資料填入 NCA 列管。",
    action: ["nca", "前往 NCA 列管"],
  },
  {
    id: "pending", name: "待判定", caption: "補齊資料後再複核", group: "case", position: [444, 436], local: true,
    input: "需要補件或等待判定的案件。",
    output: "可再次複核的待判定案件。",
    description: "保留案件與現有證據。取得資料後，重新判定 NCA 狀態。",
    action: ["nca", "前往 NCA 列管"],
  },
  {
    id: "history", name: "歷史報告", caption: "瀏覽器內的報告記錄", group: "report", position: [444, 76],
    input: "目前瀏覽器中已儲存的報告。",
    output: "重新開啟的報告內容。",
    description: "在 8D 報告側欄選取歷史報告。案件內的 8D 草稿也可從原案件開啟。",
    action: ["report", "開啟 8D 報告"],
  },
  {
    id: "input", name: "填寫報告資料", caption: "問題描述與參考附件", group: "report", position: [444, 186],
    input: "表單資料、參考附件，以及開啟報告時帶入的案件資料。",
    output: "用於手寫草稿或 5-Why 的問題資料。",
    description: "先確認問題標題和缺陷描述。可從案件工作區帶入案件資料，也可直接填寫。",
    action: ["report", "開啟 8D 報告"],
  },
  {
    id: "why", name: "執行 5-Why", caption: "AI 分析與產生報告", group: "report", position: [652, 76],
    input: "問題資料、附件文字和 5-Why 回覆。",
    output: "AI 產生的 8D 草稿。",
    description: "系統優先使用專案 Agent。未偵測到 Agent 時，使用 AI 設定中的 Agnes 或 Gemini。",
    action: ["report", "開啟 8D 報告"],
  },
  {
    id: "manual", name: "手寫 8D 草稿", caption: "從案件直接撰寫報告", group: "report", position: [652, 186], local: true,
    input: "問題資料和人工整理的內容。",
    output: "可編輯的 8D 草稿。",
    description: "從案件工作區開啟報告。選取「手寫 8D 草稿」以直接撰寫內容。",
    action: ["case-report", "從案件開啟報告"],
  },
  {
    id: "draft", name: "複核 8D 草稿", caption: "確認證據、原因與措施", group: "report", position: [rightmostNodeX, 186],
    input: "手寫、AI 產生或從歷史報告開啟的內容。",
    output: "可儲存或匯出的報告內容。",
    description: "用「編輯草稿」修訂內容。確認原因與措施都有對應證據。",
    action: ["report", "返回 8D 報告"],
  },
  {
    id: "files", name: "匯出 8D 報告", caption: "Word、HTML 或 PDF", group: "output", position: [rightmostNodeX, 296],
    input: "目前報告內容和表單資料。",
    output: "Word、HTML 或 PDF 檔案。",
    description: "在報告頁選取所需格式。檔案會交由瀏覽器儲存。",
    action: ["report", "返回 8D 報告"],
  },
  {
    id: "json", name: "匯出草稿 JSON", caption: "供案件工作區匯入", group: "output", position: [rightmostNodeX, 406],
    input: "目前報告內容和表單資料。",
    output: "可匯入案件的草稿 JSON 檔案。",
    description: "在報告頁選取「匯出 Obsidian 草稿 JSON」。瀏覽器會儲存檔案。之後可在本機案件工作區匯入。",
    action: ["report", "返回 8D 報告"],
  },
  {
    id: "save", name: "儲存至案件", caption: "報告已連結原案件", group: "report", position: [652, 316], local: true,
    input: "案件 ID 和目前的 8D 草稿。",
    output: "附加至原案件的草稿版本。",
    description: "從原案件開啟報告後，選取「儲存至案件」。系統會將草稿寫入 Obsidian 知識庫。",
    action: ["case-report", "從案件開啟報告"],
  },
  {
    id: "import", name: "匯入 8D 草稿", caption: "在對應案件選取 JSON", group: "output", position: [rightmostNodeX, 526], local: true,
    input: "對應的案件和草稿 JSON 檔案。",
    output: "附加至所選案件的草稿版本。",
    description: "開啟對應案件。展開「8D 草稿」，再選取「匯入 8D 草稿」。",
    action: ["search", "選取對應案件"],
  },
  {
    id: "vault", name: "Obsidian 知識庫", caption: "案件筆記與 8D 草稿版本", group: "output", position: [652, 526], local: true,
    input: "案件複核、NCA 列管和已儲存或匯入的 8D 草稿。",
    output: "案件筆記、草稿版本和知識庫索引。",
    description: "本機服務更新知識庫。你可在案件工作區回查案件與草稿。",
    action: ["search", "回查案件"],
  },
  {
    id: "experience", name: "查閱經驗筆記", caption: "整理經驗與缺陷詞彙", group: "intake", position: [28, 546], local: true,
    input: "知識庫中的經驗筆記及已複核的案件。",
    output: "供後續案件查閱的經驗筆記和缺陷詞彙。",
    description: "查閱可沿用的經驗。需要時可編輯筆記或更新缺陷詞彙。",
    action: ["knowledge", "開啟經驗筆記"],
  },
];

export const edges: FlowEdge[] = [
  { from: "source", to: "case", sides: ["right", "top"], via: [[320, 108]] },
  { from: "new", to: "case", sides: ["right", "left"] },
  { from: "search", to: "case", sides: ["right", "left"], via: [[216, 328], [216, 218]] },
  { from: "case", to: "decision", sides: ["bottom", "top"] },
  { from: "case", to: "input", sides: ["right", "left"] },
  { from: "decision", to: "reference", sides: ["left", "top"], via: [[216, 338], [216, 398], [112, 398]], label: ["僅供參考", 164, 390] },
  { from: "decision", to: "nca", sides: ["bottom", "top"], label: ["需開立／已開立", 373, 404] },
  { from: "decision", to: "pending", sides: ["right", "top"], via: [[528, 338]], label: ["待判定", 465, 326] },
  { from: "history", to: "draft", sides: ["top", "top"], via: [[528, 52], [944, 52]] },
  { from: "input", to: "why", sides: ["top", "left"], via: [[528, 162], [632, 162], [632, 108]] },
  { from: "input", to: "manual", sides: ["right", "left"] },
  { from: "why", to: "draft", sides: ["right", "left"], via: [[840, 108], [840, 218]] },
  { from: "manual", to: "draft", sides: ["right", "left"] },
  { from: "draft", to: "files", sides: ["bottom", "top"] },
  { from: "draft", to: "json", sides: ["right", "right"], via: [[rightChannel, 218], [rightChannel, 438]] },
  { from: "draft", to: "save", sides: ["bottom", "top"], via: [[944, 273], [736, 273]], label: ["已連結案件", 805, 294] },
  { from: "save", to: "vault", sides: ["bottom", "top"] },
  { from: "reference", to: "vault", sides: ["right", "left"], via: [[216, 468], [216, 522], [609, 522], [609, 558]] },
  { from: "nca", to: "vault", sides: ["bottom", "left"], via: [[320, 522], [609, 522], [609, 558]], label: ["列管資料", 468, 546] },
  { from: "pending", to: "vault", sides: ["bottom", "left"], via: [[528, 522], [609, 522], [609, 558]] },
  { from: "json", to: "import", sides: ["bottom", "top"] },
  { from: "import", to: "vault", sides: ["left", "right"] },
  { from: "vault", to: "experience", sides: ["bottom", "right"], via: [[736, 611], [216, 611], [216, 578]] },
];

const { nodeWidth, nodeHeight } = flowLayout;
const anchors: Record<Side, Point> = {
  top: [nodeWidth / 2, 0],
  bottom: [nodeWidth / 2, nodeHeight],
  left: [0, nodeHeight / 2],
  right: [nodeWidth, nodeHeight / 2],
};

export const nodeIndex = new Map(nodes.map((node: FlowNode): [string, FlowNode] => [node.id, node]));

function anchor(id: string, side: Side): Point {
  const node = nodeIndex.get(id);
  if (!node) throw new Error(`Unknown flow node: ${id}`);
  const [x, y] = node.position;
  const [offsetX, offsetY] = anchors[side];
  return [x + offsetX, y + offsetY];
}

export function edgePoints(edge: FlowEdge): Point[] {
  return [anchor(edge.from, edge.sides[0]), ...(edge.via ?? []), anchor(edge.to, edge.sides[1])];
}
