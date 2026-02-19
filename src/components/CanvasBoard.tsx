"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import {
  CanvasToolbar,
  type Tool,
  type LineStyle,
  LINE_STYLE_TO_CAPS,
} from "@/components/canvas/CanvasToolbar";
import { BoardSceneGraph } from "@/components/canvas/BoardSceneGraph";
import { RichTextEditOverlay } from "@/components/canvas/RichTextEditOverlay";
import { RichTextDisplayLayer } from "@/components/canvas/RichTextDisplayLayer";
import { ColorPickerOverlay } from "@/components/canvas/ColorPickerOverlay";
import { useViewport } from "@/components/canvas/hooks/useViewport";
import { useShapeDraw } from "@/components/canvas/hooks/useShapeDraw";
import { useShapeTransformer } from "@/components/canvas/hooks/useRectTransformer";
import { useTrashImage } from "@/components/canvas/hooks/useTrashImage";
import { useStageMouseHandlers } from "@/components/canvas/hooks/useStageMouseHandlers";
import { useLineCreation } from "@/components/canvas/hooks/useLineCreation";
import { LineHandles } from "@/components/canvas/LineHandles";
import { useBoxSelect } from "@/components/canvas/hooks/useBoxSelect";
import { useKeyboardShortcuts } from "@/components/canvas/hooks/useKeyboardShortcuts";
import { useBoardObjectsSync } from "@/components/canvas/hooks/useBoardObjectsSync";
import {
  getChildren,
  getAbsolutePosition,
  computeReparentLocalPosition,
  computeReparentLocalPositionFromDrop,
  findContainingFrame,
  wouldCreateCycle,
} from "@/lib/board/scene-graph";
import type { ConnectorCreateOpts } from "@/components/canvas/hooks/useLineCreation";
import {
  anchorKindToConnectorAnchor,
  findNearestNodeAndAnchor,
  getLineGeometry,
  getConnectorsAttachedToNode,
} from "@/lib/line/geometry";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { CursorPresenceLayer } from "@/components/canvas/CursorPresenceLayer";
import {
  DEFAULT_STICKY,
  DEFAULT_TEXT,
  DEFAULT_RECT,
  DEFAULT_CIRCLE,
  DEFAULT_FRAME,
  DEFAULT_LINE_LENGTH,
  DEFAULT_STICKY_COLOR,
  DEFAULT_RECT_COLOR,
  DEFAULT_FRAME_COLOR,
  MIN_TEXT_WIDTH,
  MIN_TEXT_HEIGHT,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  MIN_FRAME_WIDTH,
  MIN_FRAME_HEIGHT,
  MIN_CIRCLE_SIZE,
  DRAFT_RECT_FILL,
  DRAFT_RECT_STROKE,
  DRAFT_RECT_DASH,
  DRAFT_CIRCLE_FILL,
  DRAFT_CIRCLE_STROKE,
  DRAFT_CIRCLE_DASH,
  DRAFT_LINE_STROKE,
  DRAFT_LINE_DASH,
  BOX_SELECT_FILL,
  BOX_SELECT_STROKE,
  BOX_SELECT_DASH,
  TRASH_CORNER_OFFSET,
  TEXT_SELECTION_PADDING,
  TEXT_SELECTION_ANCHOR_SIZE,
  CONNECTOR_SNAP_RADIUS,
} from "@/components/canvas/constants";

type CanvasBoardProps = { boardId: string };

export function CanvasBoard({ boardId }: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
  const dragGroupRef = useRef<{
    draggedId: string;
    startX: number;
    startY: number;
    others: Array<{
      id: string;
      startX: number;
      startY: number;
      startX2?: number;
      startY2?: number;
    }>;
  } | null>(null);

  const registerNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefsMap.current.set(id, node);
    } else {
      nodeRefsMap.current.delete(id);
    }
  }, []);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorPickerState, setColorPickerState] = useState<{
    id: string;
    anchor: { x: number; y: number };
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null);
  const [lineStyle, setLineStyle] = useState<LineStyle>("right");

  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const updateObjectStore = useBoardStore((state) => state.updateObject);
  const setSelection = useBoardStore((state) => state.setSelection);
  const toggleSelection = useBoardStore((state) => state.toggleSelection);
  const clearSelection = useBoardStore((state) => state.clearSelection);

  const { trackCursor, cursorsRef } = useBoardPresenceContext();
  const { addObject, updateObject, removeObject } = useBoardObjectsSync(boardId);

  const trashImage = useTrashImage();
  const { viewport, handleWheel, getWorldPoint, startPan, panMove, endPan } =
    useViewport();

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      setEditingId(id);
    },
    [addObject, setSelection]
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
      const size = Math.max(MIN_CIRCLE_SIZE, Math.min(bounds.width, bounds.height));
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
        for (const childId of selection) {
          const child = objects[childId];
          if (!child || child.type === "line") continue;
          const { x: newX, y: newY } = computeReparentLocalPosition(
            child as import("@/lib/board/store").BoardObjectWithMeta,
            id,
            { ...objects, [id]: object as import("@/lib/board/store").BoardObjectWithMeta }
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

  const lineCreation = useLineCreation({
    getWorldPoint,
    objects,
    createLine: createLineFromHandle,
    createConnector,
    onFinish: useCallback(() => {}, []),
  });

  useShapeTransformer({
    selection,
    objects,
    nodeRefsMap,
    transformerRef,
  });

  useKeyboardShortcuts({
    selection,
    objects,
    addObject,
    removeObject,
    clearSelection,
    setSelection,
    isEditingText: !!editingId,
  });

  const handleObjectDragStart = useCallback(
    (id: string) => {
      setDraggingId(id);
      setDropTargetFrameId(null);
      if (!selection.includes(id) || selection.length <= 1) return;
      const obj = objects[id];
      if (!obj) return;
      const others = selection
        .filter((oid) => oid !== id)
        .map((oid) => {
          const o = objects[oid];
          if (!o) return null;
          if (o.type === "line") {
            const geom = getLineGeometry(
              o as BoardObject & { type: "line"; data?: Record<string, unknown> },
              objects
            );
            return { id: oid, startX: geom.startX, startY: geom.startY, startX2: geom.endX, startY2: geom.endY };
          }
          return { id: oid, startX: o.x, startY: o.y };
        })
        .filter((o): o is NonNullable<typeof o> => o != null);
      dragGroupRef.current = { draggedId: id, startX: obj.x, startY: obj.y, others };
    },
    [objects, selection]
  );

  const handleObjectDragMove = useCallback(
    (id: string, x: number, y: number, lineEnd?: { x2: number; y2: number }) => {
      const state = dragGroupRef.current;

      // Update drop-target frame highlight and compute frames to exclude from "others" movement
      const obj = objects[id];
      let currentParentId: string | null = null;
      let dropTargetFrameId: string | null = null;
      if (obj) {
        currentParentId = obj.parentId ?? null;
        const parentAbs =
          currentParentId != null ? getAbsolutePosition(currentParentId, objects) : { x: 0, y: 0 };
        const w = "width" in obj ? (obj as { width: number }).width : 0;
        const h = "height" in obj ? (obj as { height: number }).height : 0;
        const absPoint = { x: parentAbs.x + x + w / 2, y: parentAbs.y + y + h / 2 };
        const targetFrameId = findContainingFrame(absPoint, objects, id);
        dropTargetFrameId = targetFrameId;
        const wouldReparent =
          (targetFrameId ?? null) !== currentParentId &&
          (targetFrameId === null || !wouldCreateCycle(id, targetFrameId, objects));
        setDropTargetFrameId(wouldReparent && targetFrameId ? targetFrameId : null);

        // Update the dragged node's position during drag so connectors attached to it
        // update in real-time (geometry is derived from store)
        if (obj.type !== "line") {
          updateObjectStore(id, { x, y });
        }
      }

      if (lineEnd) {
        const prevData = (objects[id]?.data ?? {}) as Record<string, unknown>;
        updateObjectStore(id, {
          x,
          y,
          data: { ...prevData, x2: lineEnd.x2, y2: lineEnd.y2, endX: lineEnd.x2, endY: lineEnd.y2 },
        });
      }
      if (!state || state.draggedId !== id) return;
      const dx = x - state.startX;
      const dy = y - state.startY;

      for (const other of state.others) {
        if (other.id === currentParentId || other.id === dropTargetFrameId) continue;

        const o = objects[other.id];
        const connData = o?.type === "line" ? (o.data as { start?: { type?: string; nodeId?: string }; end?: { type?: string; nodeId?: string }; startShapeId?: string; endShapeId?: string }) : null;
        const startNode = connData?.start?.type === "attached" ? (connData.start as { nodeId?: string }).nodeId : connData?.startShapeId;
        const endNode = connData?.end?.type === "attached" ? (connData.end as { nodeId?: string }).nodeId : connData?.endShapeId;
        const attachedToDragged =
          connData &&
          selection.some((sid) => sid === startNode || sid === endNode);
        if (attachedToDragged) continue;
        if (other.startX2 !== undefined && other.startY2 !== undefined) {
          const prevData = (o?.data ?? {}) as Record<string, unknown>;
          const hasNewFormat = !!(prevData.start || prevData.end);
          if (hasNewFormat && (prevData.start as { type?: string })?.type === "free" && (prevData.end as { type?: string })?.type === "free") {
            updateObjectStore(other.id, {
              data: {
                ...prevData,
                start: { type: "free", x: other.startX + dx, y: other.startY + dy },
                end: { type: "free", x: other.startX2 + dx, y: other.startY2 + dy },
              },
            });
          } else {
            updateObjectStore(other.id, {
              x: other.startX + dx,
              y: other.startY + dy,
              data: { ...prevData, x2: other.startX2 + dx, y2: other.startY2 + dy, endX: other.startX2 + dx, endY: other.startY2 + dy },
            });
          }
        } else {
          updateObjectStore(other.id, { x: other.startX + dx, y: other.startY + dy });
        }
      }
    },
    [updateObjectStore, objects, selection]
  );

  const handleObjectDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      setDraggingId(null);
      setDropTargetFrameId(null);
      const state = dragGroupRef.current;
      dragGroupRef.current = null;

      const obj = objects[id];
      if (!obj) return;
      const startX = state?.draggedId === id ? state.startX : obj.x;
      const startY = state?.draggedId === id ? state.startY : obj.y;
      const dx = x - startX;
      const dy = y - startY;

      const parentAbs =
        obj.parentId != null ? getAbsolutePosition(obj.parentId, objects) : { x: 0, y: 0 };
      const w = "width" in obj ? (obj as { width: number }).width : 0;
      const h = "height" in obj ? (obj as { height: number }).height : 0;
      const absPoint = {
        x: parentAbs.x + x + w / 2,
        y: parentAbs.y + y + h / 2,
      };
      const targetFrameId = findContainingFrame(absPoint, objects, id);
      const newParentId = targetFrameId ?? null;
      const currentParentId = obj.parentId ?? null;
      const isReparent = newParentId !== currentParentId;

      if (
        isReparent &&
        (newParentId === null || !wouldCreateCycle(id, newParentId, objects))
      ) {
        const { x: newX, y: newY } = computeReparentLocalPositionFromDrop(
          x,
          y,
          currentParentId,
          newParentId,
          objects
        );
        updateObject(id, { parentId: newParentId, x: newX, y: newY });
      } else {
        updateObject(id, { x, y });
      }

      // Only move "others" when NOT reparenting. When reparenting, dx/dy are in the object's
      // coord system and don't apply to world-space frames or other objects correctly.
      if (!isReparent && selection.includes(id) && selection.length > 1) {
        // Exclude newParentId (frame we're dropping into) and currentParentId (frame we're dragging out of)
        const othersToUpdate =
          state?.draggedId === id
            ? state.others.filter((o) => o.id !== newParentId && o.id !== currentParentId)
            : selection
                .filter((oid) => oid !== id && oid !== newParentId && oid !== currentParentId)
                .map((oid) => {
                  const o = objects[oid];
                  if (!o) return null;
                  if (o.type === "line") {
                    const geom = getLineGeometry(
                      o as BoardObject & { type: "line"; data?: Record<string, unknown> },
                      objects
                    );
                    return { id: oid, startX: geom.startX, startY: geom.startY, startX2: geom.endX, startY2: geom.endY };
                  }
                  return { id: oid, startX: o.x, startY: o.y };
                })
                .filter((o): o is NonNullable<typeof o> => o != null);

        // If we reparented into a frame that was in the selection, restore it to its original
        // position (it was moved optimistically during drag but should stay put as the drop target).
        // If we reparented into a frame that was in the selection, restore it to its original
        // position (it was moved optimistically during drag but should stay put as the drop target).
        if (newParentId != null && selection.includes(newParentId)) {
          const frameInOthers = state?.draggedId === id && state.others.find((o) => o.id === newParentId);
          if (frameInOthers) {
            updateObject(newParentId, { x: frameInOthers.startX, y: frameInOthers.startY });
          }
        }
        if (currentParentId != null && selection.includes(currentParentId)) {
          const frameInOthers = state?.draggedId === id && state.others.find((o) => o.id === currentParentId);
          if (frameInOthers) {
            updateObject(currentParentId, { x: frameInOthers.startX, y: frameInOthers.startY });
          }
        }

        for (const other of othersToUpdate) {
          const o = objects[other.id];
          const connData = o?.type === "line" ? (o.data as { start?: { nodeId?: string }; end?: { nodeId?: string }; startShapeId?: string; endShapeId?: string }) : null;
          const startNode = connData?.start && (connData.start as { type?: string }).type === "attached" ? (connData.start as { nodeId?: string }).nodeId : connData?.startShapeId;
          const endNode = connData?.end && (connData.end as { type?: string }).type === "attached" ? (connData.end as { nodeId?: string }).nodeId : connData?.endShapeId;
          const attachedToMoved =
            connData &&
            selection.some((sid) => sid === startNode || sid === endNode);
          if (attachedToMoved) continue;
          if (other.startX2 !== undefined && other.startY2 !== undefined) {
            const prevData = (o?.data ?? {}) as Record<string, unknown>;
            const startEp = prevData.start as { type?: string } | undefined;
            const endEp = prevData.end as { type?: string } | undefined;
            if (startEp?.type === "free" && endEp?.type === "free") {
              updateObject(other.id, {
                data: {
                  ...prevData,
                  start: { type: "free", x: other.startX + dx, y: other.startY + dy },
                  end: { type: "free", x: other.startX2 + dx, y: other.startY2 + dy },
                },
              });
            } else {
              updateObject(other.id, {
                x: other.startX + dx,
                y: other.startY + dy,
                data: { ...prevData, x2: other.startX2 + dx, y2: other.startY2 + dy },
              });
            }
          } else {
            updateObject(other.id, { x: other.startX + dx, y: other.startY + dy });
          }
        }
      }
    },
    [updateObject, objects, selection]
  );

  const handleSelect = useCallback(
    (id: string, shiftKey?: boolean) => {
      if (activeTool !== "select") return;
      if (shiftKey) {
        toggleSelection(id);
      } else {
        setSelection(id);
      }
    },
    [activeTool, setSelection, toggleSelection]
  );

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const handleDelete = useCallback(
    (id: string) => {
      const obj = objects[id];
      if (obj?.type === "frame") {
        const children = getChildren(id, objects);
        const newParentId = obj.parentId ?? null;
        for (const child of children) {
          const { x, y } = computeReparentLocalPosition(child, newParentId, objects);
          updateObject(child.id, { parentId: newParentId, x, y });
        }
      }
      const attachedConnectors = getConnectorsAttachedToNode(id, objects);
      for (const connId of attachedConnectors) {
        removeObject(connId);
      }
      removeObject(id);
      clearSelection();
    },
    [removeObject, clearSelection, objects, updateObject]
  );

  function handleColorChange(id: string, color: string) {
    updateObject(id, { color });
  }

  function handleCustomColor(id: string, anchor: { x: number; y: number }) {
    setColorPickerState({ id, anchor });
  }

  const handleTransformerTransformEnd = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = transformer.getNodes();
    for (const node of nodes) {
      const id = node.name();
      const obj = objects[id];
      if (!obj) continue;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      // Node is inner Group at (0,0) relative to parent; parent is at (obj.x, obj.y)
      const offsetX = node.x();
      const offsetY = node.y();
      node.x(0);
      node.y(0);
      const newX = obj.x + offsetX;
      const newY = obj.y + offsetY;

      if (obj.type === "line") {
        const x2 = (obj.data as { x2?: number; y2?: number })?.x2 ?? obj.x;
        const y2 = (obj.data as { x2?: number; y2?: number })?.y2 ?? obj.y;
        if (selection.length > 1) {
          // Lines in a group: only translate, never scale (scaling would distort the line)
          updateObject(id, {
            x: newX,
            y: newY,
            data: { x2: x2 + offsetX, y2: y2 + offsetY },
          });
        } else {
          // Single line: allow resize via Transformer
          const line = (node as Konva.Container).findOne("Line") as Konva.Line | undefined;
          if (line) {
            const pts = line.points();
            const localX2 = pts.length >= 4 ? pts[2] : x2 - obj.x;
            const localY2 = pts.length >= 4 ? pts[3] : y2 - obj.y;
            const newX2 = newX + localX2 * scaleX;
            const newY2 = newY + localY2 * scaleY;
            updateObject(id, { x: newX, y: newY, data: { x2: newX2, y2: newY2 } });
          }
        }
      } else {
        const shape = (node as Konva.Container).findOne("Rect");
        if (shape) {
          const w = shape.width() * scaleX;
          const h = shape.height() * scaleY;
          if (obj.type === "circle") {
            const size = Math.max(MIN_CIRCLE_SIZE, Math.min(w, h));
            updateObject(id, { x: newX, y: newY, width: size, height: size });
          } else if (obj.type === "frame") {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_FRAME_WIDTH, w),
              height: Math.max(MIN_FRAME_HEIGHT, h),
            });
          } else if (obj.type === "text") {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_TEXT_WIDTH, w),
              height: Math.max(MIN_TEXT_HEIGHT, h),
            });
          } else {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_RECT_WIDTH, w),
              height: Math.max(MIN_RECT_HEIGHT, h),
            });
          }
        }
      }
    }
  }, [updateObject, objects, selection, transformerRef]);

  const handleLineAnchorMove = useCallback(
    (id: string, anchor: "start" | "end", x: number, y: number) => {
      const obj = objects[id];
      if (!obj) return;
      const prevData = (obj.data ?? {}) as Record<string, unknown>;
      if (anchor === "start") {
        updateObject(id, {
          x: 0,
          y: 0,
          data: { ...prevData, start: { type: "free", x, y } },
        });
      } else {
        updateObject(id, { data: { ...prevData, end: { type: "free", x, y } } });
      }
    },
    [objects, updateObject]
  );

  const handleLineAnchorDrop = useCallback(
    (id: string, anchor: "start" | "end", x: number, y: number) => {
      const obj = objects[id];
      if (!obj) return;
      const prevData = (obj.data ?? {}) as Record<string, unknown>;
      const snap = findNearestNodeAndAnchor(
        { x, y },
        objects,
        undefined,
        CONNECTOR_SNAP_RADIUS
      );

      if (snap) {
        const endpoint = {
          type: "attached",
          nodeId: snap.nodeId,
          anchor: anchorKindToConnectorAnchor(snap.anchor),
        };
        if (anchor === "start") {
          updateObject(id, {
            x: 0,
            y: 0,
            data: { ...prevData, start: endpoint },
          });
        } else {
          updateObject(id, { data: { ...prevData, end: endpoint } });
        }
      } else {
        if (anchor === "start") {
          updateObject(id, {
            x: 0,
            y: 0,
            data: { ...prevData, start: { type: "free", x, y } },
          });
        } else {
          updateObject(id, { data: { ...prevData, end: { type: "free", x, y } } });
        }
      }
    },
    [objects, updateObject]
  );

  const handleLineMove = useCallback(
    (id: string, x: number, y: number, x2: number, y2: number) => {
      setDraggingId(null);
      const obj = objects[id];
      if (!obj) return;
      const prevData = (obj.data ?? {}) as Record<string, unknown>;
      const hasNewFormat = !!(prevData.start || prevData.end);
      if (hasNewFormat) {
        const startEp = prevData.start as { type?: string } | undefined;
        const endEp = prevData.end as { type?: string } | undefined;
        if (startEp?.type === "free" && endEp?.type === "free") {
          updateObject(id, {
            data: {
              ...prevData,
              start: { type: "free", x, y },
              end: { type: "free", x: x2, y: y2 },
            },
          });
        } else {
          updateObject(id, { x, y, data: { ...prevData, x2, y2 } });
        }
      } else {
        updateObject(id, { x, y, data: { ...prevData, x2, y2 } });
      }
      const geom = getLineGeometry(
        obj as BoardObject & { type: "line"; data?: Record<string, unknown> },
        objects
      );
      const dx = x - geom.startX;
      const dy = y - geom.startY;
      if (selection.includes(id) && selection.length > 1) {
        for (const otherId of selection) {
          if (otherId === id) continue;
          const other = objects[otherId];
          if (!other) continue;
          if (other.type === "line") {
            const ogeom = getLineGeometry(
              other as BoardObject & { type: "line"; data?: Record<string, unknown> },
              objects
            );
            const oData = (other.data ?? {}) as Record<string, unknown>;
            if ((oData.start as { type?: string })?.type === "free" && (oData.end as { type?: string })?.type === "free") {
              updateObject(otherId, {
                data: {
                  ...oData,
                  start: { type: "free", x: ogeom.startX + dx, y: ogeom.startY + dy },
                  end: { type: "free", x: ogeom.endX + dx, y: ogeom.endY + dy },
                },
              });
            } else {
              updateObject(otherId, {
                x: (other as { x: number }).x + dx,
                y: (other as { y: number }).y + dy,
                data: { ...oData, x2: ogeom.endX + dx, y2: ogeom.endY + dy },
              });
            }
          } else {
            updateObject(otherId, { x: (other as { x: number }).x + dx, y: (other as { y: number }).y + dy });
          }
        }
      }
    },
    [updateObject, objects, selection]
  );

  const handleStartEdit = useCallback((id: string) => setEditingId(id), []);

  const handleSaveEdit = useCallback(
    (text: string) => {
      if (editingId) {
        updateObject(editingId, { text });
        setEditingId(null);
      }
    },
    [editingId, updateObject]
  );

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const boxSelect = useBoxSelect({
    getWorldPoint,
    objects,
    setSelection,
    selection,
  });

  const shapeDraw = useShapeDraw({
    active:
      activeTool === "rect" ||
      activeTool === "circle" ||
      activeTool === "frame" ||
      activeTool === "line",
    shapeTool:
      activeTool === "rect" || activeTool === "circle" || activeTool === "frame"
        ? activeTool
        : activeTool === "line"
          ? "line"
          : "rect",
    defaultRect: DEFAULT_RECT,
    defaultCircle: DEFAULT_CIRCLE,
    defaultFrame: DEFAULT_FRAME,
    defaultLineLength: DEFAULT_LINE_LENGTH,
    getWorldPoint,
    onCreateRect: createRect,
    onCreateCircle: createCircle,
    onCreateFrame: createFrame,
    onCreateLine: createLine,
    onFinish: useCallback(() => setActiveTool("select"), [setActiveTool]),
    onClearSelection: useCallback(() => clearSelection(), [clearSelection]),
  });

  const stageHandlers = useStageMouseHandlers({
    activeTool,
    getWorldPoint,
    startPan,
    panMove,
    endPan,
    shapeDraw,
    boxSelect,
    createSticky,
    createText,
    setActiveTool,
    clearSelection,
    lineCreation,
  });

  const boundBoxFunc = useCallback(
    (
      oldBox: { x: number; y: number; width: number; height: number; rotation: number },
      newBox: { x: number; y: number; width: number; height: number; rotation: number }
    ) => {
      const hasFrame = selection.some((id) => objects[id]?.type === "frame");
      const hasText = selection.some((id) => objects[id]?.type === "text");
      const minW = hasFrame ? MIN_FRAME_WIDTH : hasText ? MIN_TEXT_WIDTH : MIN_RECT_WIDTH;
      const minH = hasFrame ? MIN_FRAME_HEIGHT : hasText ? MIN_TEXT_HEIGHT : MIN_RECT_HEIGHT;
      if (newBox.width < minW || newBox.height < minH) {
        return oldBox;
      }
      return newBox;
    },
    [selection, objects]
  );

  const editingObject =
    editingId && objects[editingId]
      ? (objects[editingId] as BoardObject & { type: "sticky" | "text" })
      : null;
  const isEditingSticky = editingObject?.type === "sticky";
  const isEditingText = editingObject?.type === "text";

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute left-6 top-6 z-10 flex flex-row flex-nowrap items-center gap-3">
        <CanvasToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          lineStyle={lineStyle}
          onLineStyleChange={setLineStyle}
        />
      </div>

      <div className="relative">
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={false}
          onWheel={handleWheel}
          onMouseDown={stageHandlers.onMouseDown}
          onMouseMove={(e) => {
            stageHandlers.onMouseMove(e);
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (stage && pointer) trackCursor(getWorldPoint(stage, pointer));
          }}
          onMouseUp={stageHandlers.onMouseUp}
          onMouseLeave={() => {
            stageHandlers.onMouseLeave();
            setHoveredId(null);
          }}
        >
          <Layer>
            {(shapeDraw.draftShape?.type === "rect" ||
              shapeDraw.draftShape?.type === "frame") && (
              <Rect
                x={shapeDraw.draftShape.bounds.x}
                y={shapeDraw.draftShape.bounds.y}
                width={shapeDraw.draftShape.bounds.width}
                height={shapeDraw.draftShape.bounds.height}
                fill={DRAFT_RECT_FILL}
                stroke={DRAFT_RECT_STROKE}
                dash={DRAFT_RECT_DASH}
              />
            )}
            {shapeDraw.draftShape?.type === "circle" && (() => {
              const b = shapeDraw.draftShape.bounds;
              const size = Math.max(Math.abs(b.width), Math.abs(b.height));
              const cx = b.x + b.width / 2;
              const cy = b.y + b.height / 2;
              return (
                <Rect
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  cornerRadius={size / 2}
                  fill={DRAFT_CIRCLE_FILL}
                  stroke={DRAFT_CIRCLE_STROKE}
                  dash={DRAFT_CIRCLE_DASH}
                />
              );
            })()}
            {boxSelect.draftBox && (
              <Rect
                x={boxSelect.draftBox.x}
                y={boxSelect.draftBox.y}
                width={boxSelect.draftBox.width}
                height={boxSelect.draftBox.height}
                fill={BOX_SELECT_FILL}
                stroke={BOX_SELECT_STROKE}
                dash={BOX_SELECT_DASH}
                listening={false}
              />
            )}
            {shapeDraw.draftShape?.type === "line" && (
              <Line
                points={[
                  shapeDraw.draftShape.bounds.x1,
                  shapeDraw.draftShape.bounds.y1,
                  shapeDraw.draftShape.bounds.x2,
                  shapeDraw.draftShape.bounds.y2,
                ]}
                stroke={DRAFT_LINE_STROKE}
                strokeWidth={3}
                lineCap="round"
                dash={DRAFT_LINE_DASH}
              />
            )}
            {lineCreation.isCreating && lineCreation.draft && (
              <Line
                points={[
                  lineCreation.draft.startX,
                  lineCreation.draft.startY,
                  lineCreation.draft.endX,
                  lineCreation.draft.endY,
                ]}
                stroke={DRAFT_LINE_STROKE}
                strokeWidth={3}
                lineCap="round"
                dash={DRAFT_LINE_DASH}
                pointerAtEnd
                pointerLength={10}
                pointerWidth={8}
              />
            )}
            <BoardSceneGraph
              objects={objects}
              selection={selection}
              hoveredId={hoveredId}
              activeTool={activeTool}
              draggingId={draggingId}
              dropTargetFrameId={dropTargetFrameId}
              trashImage={trashImage}
              registerNodeRef={registerNodeRef}
              onSelect={handleSelect}
              onHover={handleHover}
              onDelete={handleDelete}
              onColorChange={handleColorChange}
              onCustomColor={handleCustomColor}
              onDragStart={handleObjectDragStart}
              onDragMove={(id, x, y, lineEnd) => handleObjectDragMove(id, x, y, lineEnd)}
              onDragEnd={handleObjectDragEnd}
              onLineAnchorMove={handleLineAnchorMove}
              onLineAnchorDrop={handleLineAnchorDrop}
              onLineMove={handleLineMove}
              onStartEdit={handleStartEdit}
            />
            {activeTool === "line" &&
              selection.length === 1 &&
              (() => {
                const obj = objects[selection[0]!];
                if (
                  !obj ||
                  (obj.type !== "rect" &&
                    obj.type !== "circle" &&
                    obj.type !== "sticky" &&
                    obj.type !== "text" &&
                    obj.type !== "frame")
                )
                  return null;
                return (
                  <LineHandles
                    key={`handles-${obj.id}`}
                    shape={obj}
                    onHandleMouseDown={(anchor, e) => {
                      const stage = e.target.getStage();
                      if (stage) lineCreation.start(obj.id, anchor, stage);
                    }}
                  />
                );
              })()}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              padding={
                selection.length === 1 && objects[selection[0]!]?.type === "text"
                  ? TEXT_SELECTION_PADDING
                  : TRASH_CORNER_OFFSET
              }
              anchorSize={
                selection.length === 1 && objects[selection[0]!]?.type === "text"
                  ? TEXT_SELECTION_ANCHOR_SIZE
                  : 6
              }
              boundBoxFunc={boundBoxFunc}
              onTransformEnd={handleTransformerTransformEnd}
              borderStroke={BOX_SELECT_STROKE}
              borderStrokeWidth={2}
              anchorStroke={BOX_SELECT_STROKE}
              anchorFill="white"
            />
          </Layer>
          <CursorPresenceLayer cursorsRef={cursorsRef} />
        </Stage>

        <RichTextDisplayLayer
          objects={objects}
          viewport={viewport}
          stageWidth={dimensions.width}
          stageHeight={dimensions.height}
          editingId={editingId}
        />
        {(isEditingSticky || isEditingText) && editingObject && (
          <RichTextEditOverlay
            object={editingObject}
            viewport={viewport}
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            variant={isEditingSticky ? "sticky" : "text"}
          />
        )}
        {colorPickerState && (
          <ColorPickerOverlay
            anchor={colorPickerState.anchor}
            viewport={viewport}
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            value={objects[colorPickerState.id]?.color ?? "#000000"}
            onChange={(color) => handleColorChange(colorPickerState.id, color)}
            onClose={() => setColorPickerState(null)}
          />
        )}
      </div>
    </div>
  );
}
