"use client";

import { useCallback } from "react";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { computeReparentLocalPosition } from "@/lib/board/scene-graph";
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
  lineStyle: LineStyle;
  onTextCreated?: (id: string) => void;
};

export function useObjectCreators({
  addObject,
  setSelection,
  updateObject,
  objects,
  selection,
  lineStyle,
  onTextCreated,
}: UseObjectCreatorsParams) {
  const createText = useCallback(
    (position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "text",
        parentId: null,
        x: position.x - DEFAULT_TEXT.width / 2,
        y: position.y - DEFAULT_TEXT.height / 2,
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
    [addObject, setSelection, onTextCreated]
  );

  const createSticky = useCallback(
    (position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "sticky",
        parentId: null,
        x: position.x - DEFAULT_STICKY.width / 2,
        y: position.y - DEFAULT_STICKY.height / 2,
        width: DEFAULT_STICKY.width,
        height: DEFAULT_STICKY.height,
        rotation: 0,
        color: DEFAULT_STICKY_COLOR,
        text: "New note",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
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
        text: "Frame",
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

  const createLine = useCallback(
    (bounds: { x1: number; y1: number; x2: number; y2: number }) => {
      const caps = LINE_STYLE_TO_CAPS[lineStyle];
      const snapStart = findNearestNodeAndAnchor(
        { x: bounds.x1, y: bounds.y1 },
        objects,
        undefined,
        CONNECTOR_SNAP_RADIUS
      );
      const snapEnd = findNearestNodeAndAnchor(
        { x: bounds.x2, y: bounds.y2 },
        objects,
        undefined,
        CONNECTOR_SNAP_RADIUS
      );

      const id = crypto.randomUUID();
      const data: Record<string, unknown> = {
        startCap: caps.start,
        endCap: caps.end,
        routingMode: "orthogonal",
        strokeWidth: 2,
      };

      if (snapStart && snapEnd) {
        data.start = {
          type: "attached",
          nodeId: snapStart.nodeId,
          anchor: anchorKindToConnectorAnchor(snapStart.anchor),
        };
        data.end = {
          type: "attached",
          nodeId: snapEnd.nodeId,
          anchor: anchorKindToConnectorAnchor(snapEnd.anchor),
        };
      } else if (snapStart) {
        data.start = {
          type: "attached",
          nodeId: snapStart.nodeId,
          anchor: anchorKindToConnectorAnchor(snapStart.anchor),
        };
        data.end = { type: "free", x: bounds.x2, y: bounds.y2 };
      } else if (snapEnd) {
        data.start = { type: "free", x: bounds.x1, y: bounds.y1 };
        data.end = {
          type: "attached",
          nodeId: snapEnd.nodeId,
          anchor: anchorKindToConnectorAnchor(snapEnd.anchor),
        };
      } else {
        data.start = { type: "free", x: bounds.x1, y: bounds.y1 };
        data.end = { type: "free", x: bounds.x2, y: bounds.y2 };
      }

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
        data,
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection, lineStyle, objects]
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
    createRect,
    createCircle,
    createFrame,
    createLine,
    createLineFromHandle,
    createConnector,
  };
}
