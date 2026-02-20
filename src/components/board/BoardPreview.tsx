"use client";

import { getAbsolutePosition } from "@/lib/board/scene-graph";
import type { BoardObjectWithMeta } from "@/lib/board/store";

export type PreviewObject = {
  id: string;
  type: string;
  parentId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  data?: Record<string, unknown>;
};

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 120;
const PADDING = 8;
const MAX_OBJECTS = 40;

function getAbsoluteBounds(
  objects: Record<string, PreviewObject & { parentId?: string | null }>
): { minX: number; minY: number; maxX: number; maxY: number } {
  const objs = Object.values(objects) as (PreviewObject & { parentId?: string | null })[];
  if (objs.length === 0) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  }

  const withAbs = objs.map((o) => {
    const abs = getAbsolutePosition(o.id, objects as Record<string, BoardObjectWithMeta>);
    return {
      ...o,
      absX: abs.x,
      absY: abs.y,
      right: abs.x + o.width,
      bottom: abs.y + o.height,
    };
  });

  const minX = Math.min(...withAbs.map((o) => o.absX));
  const minY = Math.min(...withAbs.map((o) => o.absY));
  const maxX = Math.max(...withAbs.map((o) => o.right));
  const maxY = Math.max(...withAbs.map((o) => o.bottom));

  return { minX, minY, maxX, maxY };
}

function toScale(
  x: number,
  y: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): [number, number] {
  const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
  const rangeY = Math.max(bounds.maxY - bounds.minY, 1);
  const scaleX = (PREVIEW_WIDTH - 2 * PADDING) / rangeX;
  const scaleY = (PREVIEW_HEIGHT - 2 * PADDING) / rangeY;
  const scale = Math.min(scaleX, scaleY, 1);
  const offX = (PREVIEW_WIDTH - scale * rangeX) / 2;
  const offY = (PREVIEW_HEIGHT - scale * rangeY) / 2;
  const px = PADDING + offX + (x - bounds.minX) * scale;
  const py = PADDING + offY + (y - bounds.minY) * scale;
  return [px, py];
}

type Props = {
  objects: PreviewObject[];
};

export function BoardPreview({ objects }: Props) {
  if (objects.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-400"
        style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
      >
        <span className="text-xs">Empty board</span>
      </div>
    );
  }

  const objectsRecord = objects.slice(0, MAX_OBJECTS).reduce(
    (acc, o) => {
      acc[o.id] = { ...o, parentId: o.parentId ?? null };
      return acc;
    },
    {} as Record<string, PreviewObject & { parentId?: string | null }>
  );

  const bounds = getAbsoluteBounds(objectsRecord);

  const renderObject = (obj: PreviewObject) => {
    const { x: absX, y: absY } = getAbsolutePosition(obj.id, objectsRecord as Record<string, BoardObjectWithMeta>);
    const [x1, y1] = toScale(absX, absY, bounds);
    const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
    const rangeY = Math.max(bounds.maxY - bounds.minY, 1);
    const scaleX = (PREVIEW_WIDTH - 2 * PADDING) / rangeX;
    const scaleY = (PREVIEW_HEIGHT - 2 * PADDING) / rangeY;
    const scale = Math.min(scaleX, scaleY, 1);
    const w = Math.max(obj.width * scale, 4);
    const h = Math.max(obj.height * scale, 4);

    const color = obj.color || "#fef08a";

    if (obj.type === "rect") {
      return (
        <rect
          key={obj.id}
          x={x1}
          y={y1}
          width={w}
          height={h}
          fill={color}
          stroke="#94a3b8"
          strokeWidth={0.5}
          rx={2}
        />
      );
    }

    if (obj.type === "circle") {
      const r = Math.min(w, h) / 2;
      return (
        <ellipse
          key={obj.id}
          cx={x1 + w / 2}
          cy={y1 + h / 2}
          rx={r}
          ry={r}
          fill={color}
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
      );
    }

    if (obj.type === "frame") {
      return (
        <rect
          key={obj.id}
          x={x1}
          y={y1}
          width={w}
          height={h}
          fill="transparent"
          stroke="#64748b"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      );
    }

    if (obj.type === "sticker") {
      return (
        <rect
          key={obj.id}
          x={x1}
          y={y1}
          width={w}
          height={h}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth={0.5}
          rx={4}
        />
      );
    }

    if (obj.type === "line") {
      const d = (obj.data ?? {}) as { x2?: number; y2?: number; endX?: number; endY?: number };
      const x2 = d.x2 ?? d.endX ?? obj.x + 80;
      const y2 = d.y2 ?? d.endY ?? obj.y;
      const [x2s, y2s] = toScale(x2, y2, bounds);
      return (
        <line
          key={obj.id}
          x1={x1}
          y1={y1}
          x2={x2s}
          y2={y2s}
          stroke={color}
          strokeWidth={Math.max(1, 2 * scale)}
        />
      );
    }

    if (obj.type === "text" || obj.type === "sticky") {
      const isSticky = obj.type === "sticky";
      const fontSize = Math.min(9, Math.floor(w / 5), Math.floor(h / 2));
      const maxChars = fontSize >= 4 ? Math.max(2, Math.floor((w - 6) / (fontSize * 0.55))) : 0;
      const snippet = (obj.text || "").slice(0, maxChars);
      const clipId = `clip-${obj.id}`;
      return (
        <g key={obj.id}>
          <defs>
            <clipPath id={clipId}>
              <rect x={x1} y={y1} width={w} height={h} rx={isSticky ? 4 : 2} />
            </clipPath>
          </defs>
          <rect
            x={x1}
            y={y1}
            width={w}
            height={h}
            fill={isSticky ? color : "white"}
            stroke="#94a3b8"
            strokeWidth={0.5}
            rx={isSticky ? 4 : 2}
          />
          {snippet && fontSize >= 4 && (
            <g clipPath={`url(#${clipId})`}>
              <text
                x={x1 + 3}
                y={y1 + 2}
                fontSize={fontSize}
                fill={isSticky ? "#1e293b" : "#334155"}
                dominantBaseline="hanging"
              >
                {snippet}
              </text>
            </g>
          )}
        </g>
      );
    }

    return null;
  };

  const objs = Object.values(objectsRecord) as PreviewObject[];

  return (
    <svg
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
      className="rounded border border-slate-200 bg-white"
    >
      <rect width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} fill="#f8fafc" />
      <g>{objs.map(renderObject)}</g>
    </svg>
  );
}
