import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowRight, Minus, Plus, RotateCcw } from "lucide-react";
import { canvasWidth, edgePoints, edges, flowLayout, groups, nodeIndex, nodes, type FlowEdge, type FlowGroup, type FlowNode } from "./projectMapFlow";
import type { MapDestination } from "./ProjectMap";

const { nodeWidth, nodeHeight, arrowGap } = flowLayout;
const centerX = nodeWidth / 2;
const centerY = nodeHeight / 2;

function edgePath(edge: FlowEdge): string {
  const points = edgePoints(edge);
  const endIndex = points.length - 1;
  const [x, y] = points[endIndex];
  const [previousX, previousY] = points[endIndex - 1];
  points[endIndex] = [x - Math.sign(x - previousX) * arrowGap, y - Math.sign(y - previousY) * arrowGap];
  return "M " + points.map((point: [number, number]): string => point.join(" ")).join(" L ");
}

function clampZoom(value: number): number {
  return Math.max(80, Math.min(180, value));
}

export default function ProjectFlow({ localWorkspace, onNavigate }: {
  localWorkspace: boolean;
  onNavigate: (destination: MapDestination) => void;
}): ReactNode {
  const [selection, setSelection] = useState<string>();
  const [zoom, setZoom] = useState(100);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const selected = selection ? nodeIndex.get(selection) : undefined;
  const isRelated = (edge: FlowEdge): boolean => edge.from === selected?.id || edge.to === selected?.id;
  const relatedEdges = edges.filter(isRelated);
  const paintOrder = [...edges.filter((edge: FlowEdge): boolean => !isRelated(edge)), ...relatedEdges];
  const flowGroups: FlowGroup[] = ["intake", "case", "report", "output"];

  useEffect((): (() => void) | undefined => {
    const element = viewport.current;
    if (!element) return;
    const zoomWithWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current: number): number => clampZoom(current - Math.sign(event.deltaY) * 10));
    };
    element.addEventListener("wheel", zoomWithWheel, { passive: false });
    return (): void => element.removeEventListener("wheel", zoomWithWheel);
  }, []);

  const startPan = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as Element).closest("[data-flow-node]")) return;
    const element = event.currentTarget;
    drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    element.setPointerCapture(event.pointerId);
  };

  const pan = (event: PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
    event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
  };

  const endPan = (): void => {
    drag.current = null;
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2 sm:px-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {flowGroups.map((id: FlowGroup): ReactNode => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: groups[id].color }} />
              {groups[id].name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="流程圖縮放">
          <button className="btn btn-ghost p-2" type="button" aria-label="縮小流程圖" disabled={zoom === 80}
            onClick={(): void => setZoom(clampZoom(zoom - 20))}><Minus size={16} aria-hidden="true" /></button>
          <output className="min-w-12 text-center text-xs tabular-nums" aria-label="縮放比例">{zoom}%</output>
          <button className="btn btn-ghost p-2" type="button" aria-label="放大流程圖" disabled={zoom === 180}
            onClick={(): void => setZoom(clampZoom(zoom + 20))}><Plus size={16} aria-hidden="true" /></button>
          <button className="btn btn-ghost p-2" type="button" aria-label="重設流程圖視圖" title="重設視圖"
            onClick={(): void => { setZoom(100); viewport.current?.scrollTo(0, 0); }}><RotateCcw size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div ref={viewport} tabIndex={0} role="region" aria-label="資料流程圖畫布"
          className="max-h-[27rem] min-w-0 cursor-grab select-none overflow-auto bg-[var(--bg-base)] active:cursor-grabbing focus-visible:outline-2 focus-visible:-outline-offset-2 sm:max-h-[40rem]"
          onPointerDown={startPan} onPointerMove={pan} onLostPointerCapture={endPan}>
          <svg viewBox={`0 0 ${canvasWidth} 634`} role="group" aria-label="8D Creator 資料流程"
            className="mx-auto block max-w-none"
            style={{ width: `min(${zoom}%, ${canvasWidth * zoom / 100}px)`, minWidth: 820 * zoom / 100 }}>
            <defs>
              <marker id="flow-arrow" viewBox="0 0 12 10" refX="9" refY="5"
                markerWidth="12" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M 1 1 L 9 5 L 1 9 Z" fill="context-stroke" />
              </marker>
            </defs>
            {flowGroups.map((id: FlowGroup): ReactNode => {
              const group = groups[id];
              return <g key={id} aria-hidden="true">
                <rect x={group.x} y={12} width={group.width} height={610} rx={12}
                  fill={`color-mix(in srgb, ${group.color} 6%, var(--bg-surface))`} stroke="var(--border-color)" />
                <text x={group.x + 16} y={39} fill="var(--text-primary)" fontSize={14} fontWeight={500}>{group.name}</text>
              </g>;
            })}
            {paintOrder.map((edge: FlowEdge): ReactNode => {
              const connected = isRelated(edge);
              return <g key={edge.from + "-" + edge.to} aria-hidden="true">
                <path d={edgePath(edge)} stroke={connected ? "var(--accent)" : "var(--text-secondary)"}
                  strokeWidth={connected ? 2.5 : 1.5} strokeLinejoin="round" fill="none" markerEnd="url(#flow-arrow)" />
                {edge.label && <text x={edge.label[1]} y={edge.label[2]} textAnchor="middle" fontSize={12} fontWeight={400}
                  fill="var(--text-primary)" stroke="var(--bg-surface)" strokeWidth={2} paintOrder="stroke">{edge.label[0]}</text>}
              </g>;
            })}
            {nodes.map((node: FlowNode): ReactNode => {
              const active = selected?.id === node.id;
              const color = groups[node.group].color;
              const shape = {
                className: "transition-[fill,stroke] group-hover:stroke-[var(--accent)] group-focus-visible:stroke-[var(--accent)]",
                fill: active ? `color-mix(in srgb, ${color} 14%, var(--bg-surface))` : "var(--bg-surface)",
                stroke: active ? "var(--accent)" : color,
                strokeWidth: active ? 2.6 : 1.4,
              };
              return <g key={node.id} transform={`translate(${node.position.join(" ")})`}
                data-flow-node={node.id} role="button" tabIndex={0} aria-label={node.name} aria-pressed={active}
                className="group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                onClick={(): void => setSelection(node.id)}
                onKeyDown={(event): void => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelection(node.id);
                  }
                }}>
                <title>{node.description}</title>
                {node.decision
                  ? <polygon points={`${centerX},0 ${nodeWidth},${centerY} ${centerX},${nodeHeight} 0,${centerY}`} {...shape} />
                  : <rect width={nodeWidth} height={nodeHeight} rx={10} {...shape} />}
                <text x={centerX} y={node.decision ? 30 : 27} textAnchor="middle" fill="var(--text-primary)" fontSize={15} fontWeight={500}>{node.name}</text>
                <text x={centerX} y={node.decision ? 43 : 47} textAnchor="middle" fill="var(--text-secondary)" fontSize={node.decision ? 11 : 12} fontWeight={400}>{node.caption}</text>
              </g>;
            })}
          </svg>
        </div>
        <aside aria-label="節點詳情" className="border-t border-[var(--border-color)] p-4 xl:border-l xl:border-t-0">
          <div aria-live="polite">
            <h2 className="text-base font-semibold">{selected?.name ?? "節點詳情"}</h2>
            {selected ? <>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{selected.description}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="font-semibold">輸入資料</dt><dd className="mt-1 text-[var(--text-secondary)]">{selected.input}</dd></div>
                <div><dt className="font-semibold">輸出資料</dt><dd className="mt-1 text-[var(--text-secondary)]">{selected.output}</dd></div>
              </dl>
            </> : <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">選取節點以查看輸入、輸出與操作入口。</p>}
          </div>
          {selected?.action && <button type="button" className="btn btn-primary mt-4 text-sm"
            onClick={(): void => { if (selected.action) onNavigate(selected.action[0]); }}>
            {!localWorkspace && selected.local && "在本機"}{selected.action[1]}<ArrowRight size={15} aria-hidden="true" />
          </button>}
          {selected && relatedEdges.length > 0 && <ul aria-label="相連節點" className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-color)] pt-3">
            {relatedEdges.map((edge: FlowEdge): ReactNode => {
              const incoming = edge.to === selected.id;
              const other = nodeIndex.get(incoming ? edge.from : edge.to)!;
              return <li key={other.id}><button type="button" className="btn btn-secondary px-2 py-1 text-xs"
                onClick={(): void => setSelection(other.id)}>
                {incoming ? "來自" : "前往"} {other.name}
              </button></li>;
            })}
          </ul>}
        </aside>
      </div>
    </div>
  );
}
