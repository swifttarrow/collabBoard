"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Transformer } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import { useCanvasToolbar } from "@/components/canvas/CanvasToolbarContext";
import { BoardSceneGraph } from "@/components/canvas/BoardSceneGraph";
import { RichTextEditOverlay } from "@/components/canvas/RichTextEditOverlay";
import { RichTextDisplayLayer } from "@/components/canvas/RichTextDisplayLayer";
import { ColorPickerOverlay } from "@/components/canvas/ColorPickerOverlay";
import { DraftShapesLayer } from "@/components/canvas/DraftShapesLayer";
import { useViewport } from "@/components/canvas/hooks/useViewport";
import { useShapeDraw } from "@/components/canvas/hooks/useShapeDraw";
import { useShapeTransformer } from "@/components/canvas/hooks/useRectTransformer";
import { useTrashImage } from "@/components/canvas/hooks/useTrashImage";
import { useCopyImage } from "@/components/canvas/hooks/useCopyImage";
import { useStageMouseHandlers } from "@/components/canvas/hooks/useStageMouseHandlers";
import { useLineCreation } from "@/components/canvas/hooks/useLineCreation";
import { useObjectCreators } from "@/components/canvas/hooks/useObjectCreators";
import { useCanvasDimensions } from "@/components/canvas/hooks/useCanvasDimensions";
import { LineHandles } from "@/components/canvas/LineHandles";
import { useBoxSelect } from "@/components/canvas/hooks/useBoxSelect";
import { useKeyboardShortcuts } from "@/components/canvas/hooks/useKeyboardShortcuts";
import { useBoardObjectsSync } from "@/components/canvas/hooks/useBoardObjectsSync";
import { useFrameToContent } from "@/components/canvas/hooks/useFrameToContent";
import { animateViewportToObject, MIN_SCALE, MAX_SCALE } from "@/lib/viewport/tools";
import { ZoomWidget } from "@/components/canvas/ZoomWidget";
import {
  getChildren,
  getAbsolutePosition,
  computeReparentLocalPosition,
  computeReparentLocalPositionFromDrop,
  findContainingFrame,
  wouldCreateCycle,
} from "@/lib/board/scene-graph";
import {
  anchorKindToConnectorAnchor,
  findNearestNodeAndAnchor,
  getLineGeometry,
  getConnectorsAttachedToNode,
} from "@/lib/line/geometry";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { CursorPresenceLayer } from "@/components/canvas/CursorPresenceLayer";
import {
  DEFAULT_RECT,
  DEFAULT_CIRCLE,
  DEFAULT_FRAME,
  DEFAULT_LINE_LENGTH,
  MIN_TEXT_WIDTH,
  MIN_TEXT_HEIGHT,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  MIN_FRAME_WIDTH,
  MIN_FRAME_HEIGHT,
  MIN_CIRCLE_SIZE,
  TRASH_CORNER_OFFSET,
  TEXT_SELECTION_PADDING,
  TEXT_SELECTION_ANCHOR_SIZE,
  CONNECTOR_SNAP_RADIUS,
  BOX_SELECT_STROKE,
  DUPLICATE_OFFSET,
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

  const dimensions = useCanvasDimensions();
  const { activeTool, setActiveTool, lineStyle } = useCanvasToolbar();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorPickerState, setColorPickerState] = useState<{
    id: string;
    anchor: { x: number; y: number };
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null);
  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const updateObjectStore = useBoardStore((state) => state.updateObject);
  const setSelection = useBoardStore((state) => state.setSelection);
  const toggleSelection = useBoardStore((state) => state.toggleSelection);
  const clearSelection = useBoardStore((state) => state.clearSelection);

  const {
    trackCursor,
    trackViewport,
    cursorsRef,
    followingUserId,
    unfollowUser,
  } = useBoardPresenceContext();
  const { addObject, updateObject, removeObject } = useBoardObjectsSync(
    boardId,
    {
      onFindZoom: useCallback(
        (objectId) =>
          animateViewportToObject(
            objectId,
            dimensions.width,
            dimensions.height
          ),
        [dimensions.width, dimensions.height]
      ),
    }
  );
  useFrameToContent(boardId, !!followingUserId);

  const trashImage = useTrashImage();
  const copyImage = useCopyImage();
  const { viewport, handleWheel, getWorldPoint, startPan, panMove, endPan } =
    useViewport({ followingUserId, unfollowUser });

  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Broadcast viewport on change (throttled inside trackViewport)
  useEffect(() => {
    if (!followingUserId) trackViewport(viewport);
  }, [viewport, followingUserId, trackViewport]);

  // Periodic viewport broadcast so followers get updates even when followed user is idle
  useEffect(() => {
    if (followingUserId) return;
    const interval = setInterval(
      () => trackViewport(viewportRef.current),
      350
    );
    return () => clearInterval(interval);
  }, [followingUserId, trackViewport]);

  const {
    createText,
    createSticky,
    createRect,
    createCircle,
    createFrame,
    createLine,
    createLineFromHandle,
    createConnector,
  } = useObjectCreators({
    addObject,
    setSelection,
    updateObject,
    objects,
    selection,
    lineStyle,
    onTextCreated: (id) => setEditingId(id),
  });

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
    stageWidth: dimensions.width,
    stageHeight: dimensions.height,
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

  const handleDuplicate = useCallback(
    (id: string) => {
      const obj = objects[id];
      if (!obj) return;
      const newId = crypto.randomUUID();
      const offset = DUPLICATE_OFFSET;
      let data = obj.data;

      if (obj.type === "line") {
        const geom = getLineGeometry(obj, objects);
        data = {
          ...(typeof data === "object" && data ? data : {}),
          x2: geom.endX + offset,
          y2: geom.endY + offset,
          start: undefined,
          end: undefined,
          startShapeId: undefined,
          endShapeId: undefined,
        };
      }

      const copy: BoardObject = {
        ...obj,
        id: newId,
        x: obj.x + offset,
        y: obj.y + offset,
        data,
      };
      addObject(copy);
      setSelection([newId]);
    },
    [objects, addObject, setSelection]
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
      const rotation = node.rotation();
      node.scaleX(1);
      node.scaleY(1);
      node.rotation(0);
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
          const newRotation = rotation;
          if (obj.type === "circle") {
            const size = Math.max(MIN_CIRCLE_SIZE, Math.min(w, h));
            updateObject(id, { x: newX, y: newY, width: size, height: size, rotation: newRotation });
          } else if (obj.type === "frame") {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_FRAME_WIDTH, w),
              height: Math.max(MIN_FRAME_HEIGHT, h),
              rotation: newRotation,
            });
          } else if (obj.type === "text") {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_TEXT_WIDTH, w),
              height: Math.max(MIN_TEXT_HEIGHT, h),
              rotation: newRotation,
            });
          } else {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_RECT_WIDTH, w),
              height: Math.max(MIN_RECT_HEIGHT, h),
              rotation: newRotation,
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
    <div className="relative h-full w-full">
      <ZoomWidget
        scale={viewport.scale}
        stageWidth={dimensions.width}
        stageHeight={dimensions.height}
      />
      <div className="relative z-0">
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
            <DraftShapesLayer
              shapeDraft={shapeDraw.draftShape}
              boxSelectDraft={boxSelect.draftBox}
              lineCreationDraft={
                lineCreation.isCreating && lineCreation.draft
                  ? {
                      startX: lineCreation.draft.startX,
                      startY: lineCreation.draft.startY,
                      endX: lineCreation.draft.endX,
                      endY: lineCreation.draft.endY,
                    }
                  : null
              }
            />
            <BoardSceneGraph
              objects={objects}
              selection={selection}
              hoveredId={hoveredId}
              activeTool={activeTool}
              draggingId={draggingId}
              dropTargetFrameId={dropTargetFrameId}
              trashImage={trashImage}
              copyImage={copyImage}
              registerNodeRef={registerNodeRef}
              onSelect={handleSelect}
              onHover={handleHover}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
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
              rotateEnabled={!selection.some((id) => objects[id]?.type === "line")}
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
          selection={selection}
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
