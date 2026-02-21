"use client";

import { useCallback } from "react";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import {
  computeReparentLocalPosition,
  findContainingFrame,
  getAbsolutePosition,
} from "@/lib/board/scene-graph";
import {
  anchorKindToConnectorAnchor,
  findNearestNodeAndAnchor,
} from "@/lib/line/geometry";
import { LINE_STYLE_TO_CAPS } from "@/components/canvas/CanvasToolbar";
import type { LineStyle } from "@/components/canvas/CanvasToolbar";
import type { ConnectorCreateOpts } from "./useLineCreation";
import {
  DEFAULT_STICKY,
  DEFAULT_TEXT,
  DEFAULT_RECT_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKER,
  MIN_CIRCLE_SIZE,
  MIN_FRAME_WIDTH,
  MIN_FRAME_HEIGHT,
  CONNECTOR_SNAP_RADIUS,
} from "@/components/canvas/constants";

export type UseObjectCreatorsParams = {
  addObject: (obj: BoardObject) => void;
  setSelection: (ids: string[] | string | null) => void;
  updateObject: (id: string, updates: Partial<BoardObject>) => void;
  objects: Record<string, BoardObjectWithMeta>;
  selection: string[];
  /** For connectors; defaults to "none" (point/point). Endpoint type can be toggled via floating UI. */
  lineStyle?: LineStyle;
  onTextCreated?: (id: string) => void;
};

export function useObjectCreators({
  addObject,
  setSelection,
  updateObject,
  objects,
  selection,
  lineStyle = "none",
  onTextCreated,
}: UseObjectCreatorsParams) {
  const createText = useCallback(
    (position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const centerX = position.x;
      const centerY = position.y;
      const worldX = centerX - DEFAULT_TEXT.width / 2;
      const worldY = centerY - DEFAULT_TEXT.height / 2;
      const frameId = findContainingFrame({ x: centerX, y: centerY }, objects);
      let x = worldX;
      let y = worldY;
      let parentId: string | null = null;
      if (frameId) {
        parentId = frameId;
        const frameAbs = getAbsolutePosition(frameId, objects);
        x = worldX - frameAbs.x;
        y = worldY - frameAbs.y;
      }
      const object: BoardObject = {
        id,
        type: "text",
        parentId,
        x,
        y,
        width: DEFAULT_TEXT.width,
        height: DEFAULT_TEXT.height,
        rotation: 0,
        color: "#94a3b8",
        text: "<p>Text</p>",
      };
      addObject(object);
      setSelection(id);
      onTextCreated?.(id);
    },
    [addObject, setSelection, onTextCreated, objects]
  );

  const createSticky = useCallback(
    (position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const centerX = position.x;
      const centerY = position.y;
      const worldX = centerX - DEFAULT_STICKY.width / 2;
      const worldY = centerY - DEFAULT_STICKY.height / 2;
      const frameId = findContainingFrame({ x: centerX, y: centerY }, objects);
      let x = worldX;
      let y = worldY;
      let parentId: string | null = null;
      if (frameId) {
        parentId = frameId;
        const frameAbs = getAbsolutePosition(frameId, objects);
        x = worldX - frameAbs.x;
        y = worldY - frameAbs.y;
      }
      const object: BoardObject = {
        id,
        type: "sticky",
        parentId,
        x,
        y,
        width: DEFAULT_STICKY.width,
        height: DEFAULT_STICKY.height,
        rotation: 0,
        color: DEFAULT_STICKY_COLOR,
        text: "New note",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection, objects]
  );

  const createSticker = useCallback(
    (position: { x: number; y: number }, slug: string) => {
      const id = crypto.randomUUID();
      const centerX = position.x;
      const centerY = position.y;
      const worldX = centerX - DEFAULT_STICKER.width / 2;
      const worldY = centerY - DEFAULT_STICKER.height / 2;
      const frameId = findContainingFrame({ x: centerX, y: centerY }, objects);
      let x = worldX;
      let y = worldY;
      let parentId: string | null = null;
      if (frameId) {
        parentId = frameId;
        const frameAbs = getAbsolutePosition(frameId, objects);
        x = worldX - frameAbs.x;
        y = worldY - frameAbs.y;
      }
      const object: BoardObject = {
        id,
        type: "sticker",
        parentId,
        x,
        y,
        width: DEFAULT_STICKER.width,
        height: DEFAULT_STICKER.height,
        rotation: 0,
        color: "",
        text: "",
        data: { slug },
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection, objects]
  );

  const createRect = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "rect",
        parentId: null,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  const createCircle = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      const id = crypto.randomUUID();
      const size = Math.max(
        MIN_CIRCLE_SIZE,
        Math.min(bounds.width, bounds.height)
      );
      const object: BoardObject = {
        id,
        type: "circle",
        parentId: null,
        x: bounds.x,
        y: bounds.y,
        width: size,
        height: size,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  const createFrame = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      const id = crypto.randomUUID();
      const frameX = bounds.x;
      const frameY = bounds.y;
      const frameW = Math.max(MIN_FRAME_WIDTH, bounds.width);
      const frameH = Math.max(MIN_FRAME_HEIGHT, bounds.height);
      const object: BoardObject = {
        id,
        type: "frame",
        parentId: null,
        clipContent: true,
        x: frameX,
        y: frameY,
        width: frameW,
        height: frameH,
        rotation: 0,
        color: DEFAULT_FRAME_COLOR,
        text: "",
      };
      addObject(object);
      if (selection.length > 0) {
        const objectsWithNew = {
          ...objects,
          [id]: object as BoardObjectWithMeta,
        };
        for (const childId of selection) {
          const child = objects[childId];
          if (!child || child.type === "line") continue;
          const { x: newX, y: newY } = computeReparentLocalPosition(
            child,
            id,
            objectsWithNew
          );
          updateObject(childId, { parentId: id, x: newX, y: newY });
        }
      }
      setSelection(id);
    },
    [addObject, setSelection, selection, objects, updateObject]
  );

  /** Free-floating line (from shapes dropdown). Never connects to entities. No arrowheads. */
  const createFreeLine = useCallback(
    (bounds: { x1: number; y1: number; x2: number; y2: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "line",
        parentId: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
        data: {
          start: { type: "free", x: bounds.x1, y: bounds.y1 },
          end: { type: "free", x: bounds.x2, y: bounds.y2 },
          startCap: "point",
          endCap: "point",
          routingMode: "straight",
          strokeWidth: 2,
        },
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  const createLineFromHandle = useCallback(
    (opts: { startX: number; startY: number; endX: number; endY: number }) => {
      const caps = LINE_STYLE_TO_CAPS[lineStyle];
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "line",
        parentId: null,
        x: opts.startX,
        y: opts.startY,
        width: 0,
        height: 0,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
        data: {
          x2: opts.endX,
          y2: opts.endY,
          startCap: caps.start,
          endCap: caps.end,
        },
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection, lineStyle]
  );

  const createConnector = useCallback(
    (opts: ConnectorCreateOpts) => {
      const caps = LINE_STYLE_TO_CAPS[lineStyle];
      const id = crypto.randomUUID();
      const start =
        opts.start.type === "attached"
          ? {
              type: "attached" as const,
              nodeId: opts.start.nodeId,
              anchor: anchorKindToConnectorAnchor(opts.start.anchor),
            }
          : opts.start;
      const end =
        opts.end.type === "attached"
          ? {
              type: "attached" as const,
              nodeId: opts.end.nodeId,
              anchor: anchorKindToConnectorAnchor(opts.end.anchor),
            }
          : opts.end;
      const object: BoardObject = {
        id,
        type: "line",
        parentId: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
        data: {
          start,
          end,
          routingMode: "orthogonal",
          startCap: caps.start,
          endCap: caps.end,
          strokeWidth: 2,
          strokeStyle: "dashed",
        },
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection, lineStyle]
  );

  return {
    createText,
    createSticky,
    createSticker,
    createRect,
    createCircle,
    createFrame,
    createFreeLine,
    createLineFromHandle,
    createConnector,
  };
}
