"use client";

import { useCallback } from "react";
import { Group } from "react-konva";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getRootObjects, getChildren, getAbsolutePosition } from "@/lib/board/scene-graph";
import { getLineGeometry } from "@/lib/line/geometry";
import { StickyNode } from "@/components/canvas/StickyNode";
import { StickerNode } from "@/components/canvas/StickerNode";
import { TextNode } from "@/components/canvas/TextNode";
import { RectNode } from "@/components/canvas/RectNode";
import { CircleNode } from "@/components/canvas/CircleNode";
import { FrameNode } from "@/components/canvas/FrameNode";
import { LineNode } from "@/components/canvas/LineNode";

type SceneGraphProps = {
  objects: Record<string, BoardObjectWithMeta>;
  selection: string[];
  hoveredId: string | null;
  activeTool: string;
  draggingId: string | null;
  dropTargetFrameId: string | null;
  connectionTargetId: string | null;
  connectorHandleHoveredShapeId: string | null;
  registerNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragMove: (
    id: string,
    x: number,
    y: number,
    lineEnd?: { x2: number; y2: number }
  ) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onLineAnchorMove: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onLineAnchorDrop?: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onLineMove: (id: string, x: number, y: number, x2: number, y2: number) => void;
  onStrokeStyleToggle?: (id: string) => void;
  onStartEdit: (id: string) => void;
  onContextMenu: (
    id: string,
    objectType: import("./ObjectContextMenu").ObjectContextMenuObjectType,
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onEndpointContextMenu?: (
    id: string,
    anchor: "start" | "end",
    position: { x: number; y: number }
  ) => void;
  onColorChange: (id: string, color: string) => void;
  viewport: { x: number; y: number; scale: number };
  stageWidth: number;
  stageHeight: number;
};

const CULL_MARGIN_SCREEN_PX = 240;

type ViewportWorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function intersects(bounds: ViewportWorldBounds, rect: { x: number; y: number; width: number; height: number }) {
  return !(
    rect.x + rect.width < bounds.minX ||
    rect.x > bounds.maxX ||
    rect.y + rect.height < bounds.minY ||
    rect.y > bounds.maxY
  );
}

function renderNode(
  object: BoardObjectWithMeta,
  props: SceneGraphProps,
  viewportBounds: ViewportWorldBounds,
  alwaysVisibleIds: Set<string>,
  absCache: Map<string, { x: number; y: number }>
): React.ReactNode | null {
  const {
    objects,
    selection,
    hoveredId,
    activeTool,
    draggingId,
    connectionTargetId,
    connectorHandleHoveredShapeId,
    registerNodeRef,
    onSelect,
    onHover,
    onDragStart,
    onDragMove,
    onDragEnd,
    onLineAnchorMove,
    onLineAnchorDrop,
    onLineMove,
    onStrokeStyleToggle,
    onStartEdit,
    onContextMenu,
    onEndpointContextMenu,
    onColorChange,
  } = props;

  const getAbs = (id: string) => {
    const cached = absCache.get(id);
    if (cached) return cached;
    const next = getAbsolutePosition(id, objects);
    absCache.set(id, next);
    return next;
  };

  const isAlwaysVisible = alwaysVisibleIds.has(object.id);
  let isVisible = false;
  if (object.type === "line") {
    const geom = getLineGeometry(
      object as BoardObject & { type: "line"; data?: Record<string, unknown> },
      objects
    );
    const xs = geom.points.map((p) => p.x);
    const ys = geom.points.map((p) => p.y);
    if (xs.length > 0 && ys.length > 0) {
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      isVisible = intersects(viewportBounds, {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      });
    }
  } else {
    const abs = getAbs(object.id);
    isVisible = intersects(viewportBounds, {
      x: abs.x,
      y: abs.y,
      width: Math.max(1, object.width),
      height: Math.max(1, object.height),
    });
  }

  const isSelected = selection.includes(object.id);
  const showControls =
    selection.length === 1 && isSelected && hoveredId === object.id;
  const draggable = activeTool === "select";
  const isConnectionTarget =
    object.id === connectionTargetId || object.id === connectorHandleHoveredShapeId;
  const common = {
    isSelected,
    showControls,
    draggable,
    isConnectionTarget,
    registerNodeRef,
    onSelect,
    onHover,
    onContextMenu,
    onDragStart,
    onDragMove,
    onDragEnd,
  };

  if (object.type === "rect") {
    return (
      <RectNode key={object.id} {...common} object={object as BoardObject & { type: "rect" }} />
    );
  }
  if (object.type === "circle") {
    return (
      <CircleNode key={object.id} {...common} object={object as BoardObject & { type: "circle" }} />
    );
  }
  if (object.type === "frame") {
    const children = getChildren(object.id, objects);
    const renderedChildren = children
      .map((child) => renderNode(child, props, viewportBounds, alwaysVisibleIds, absCache))
      .filter((child): child is React.ReactNode => child != null);
    if (!isAlwaysVisible && !isVisible) {
      return null;
    }
    return (
      <FrameGroup
        key={object.id}
        object={object as BoardObject & { type: "frame" }}
        props={props}
        isDropTarget={props.dropTargetFrameId === object.id}
      >
        {renderedChildren}
      </FrameGroup>
    );
  }
  if (!isAlwaysVisible && !isVisible) return null;

  if (object.type === "text") {
    return (
      <TextNode
        key={object.id}
        {...common}
        object={object as BoardObject & { type: "text" }}
        onStartEdit={onStartEdit}
      />
    );
  }
  if (object.type === "sticker") {
    return (
      <StickerNode
        key={object.id}
        {...common}
        object={object as BoardObject & { type: "sticker"; data?: { slug?: string } }}
      />
    );
  }
  if (object.type === "line") {
    const connData = (object.data as {
      start?: { type?: string; nodeId?: string };
      end?: { type?: string; nodeId?: string };
      startShapeId?: string;
      endShapeId?: string;
    }) ?? {};
    const startNode = connData.start?.type === "attached" ? (connData.start as { nodeId?: string }).nodeId : connData.startShapeId;
    const endNode = connData.end?.type === "attached" ? (connData.end as { nodeId?: string }).nodeId : connData.endShapeId;
    const isHighlighted =
      !!draggingId &&
      (startNode === draggingId || endNode === draggingId);
    return (
      <LineNode
        key={object.id}
        {...common}
        object={object as BoardObject & { type: "line" }}
        objects={objects}
        isHighlighted={isHighlighted}
        isHovered={hoveredId === object.id}
        onAnchorMove={onLineAnchorMove}
        onAnchorDrop={onLineAnchorDrop}
        onLineMove={onLineMove}
        onStrokeStyleToggle={onStrokeStyleToggle}
        onEndpointContextMenu={onEndpointContextMenu}
        onColorChange={onColorChange}
      />
    );
  }
  return (
    <StickyNode
      key={object.id}
      {...common}
      object={object as BoardObject & { type: "sticky" }}
      onStartEdit={onStartEdit}
    />
  );
}

function FrameGroup({
  object,
  children,
  props,
  isDropTarget,
}: {
  object: BoardObject & { type: "frame" };
  children: React.ReactNode;
  props: SceneGraphProps;
  isDropTarget: boolean;
}) {
  const { selection, hoveredId, activeTool, connectionTargetId, connectorHandleHoveredShapeId, onDragStart, onDragMove, onDragEnd } = props;
  const isConnectionTarget =
    object.id === connectionTargetId || object.id === connectorHandleHoveredShapeId;
  const isSelected = selection.includes(object.id);
  const showControls =
    selection.length === 1 && isSelected && hoveredId === object.id;
  const draggable = activeTool === "select";

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      onDragStart(object.id);
    },
    [object.id, onDragStart]
  );

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const target = e.target;
      onDragMove(object.id, target.x(), target.y());
    },
    [object.id, onDragMove]
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd (would overwrite its position)
      const target = e.target;
      onDragEnd(object.id, target.x(), target.y());
    },
    [object.id, onDragEnd]
  );

  return (
    <Group
      x={object.x}
      y={object.y}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.cancelBubble = true;
        props.onSelect(object.id, e.evt.shiftKey);
      }}
      onMouseEnter={() => props.onHover(object.id)}
      onMouseLeave={() => props.onHover(null)}
    >
      <FrameNode
        key={object.id}
        object={object}
        position={{ x: 0, y: 0 }}
        isSelected={isSelected}
        showControls={showControls}
        isDropTarget={isDropTarget}
        isConnectionTarget={isConnectionTarget}
        draggable={false}
        registerNodeRef={props.registerNodeRef}
        onSelect={props.onSelect}
        onHover={props.onHover}
        onContextMenu={props.onContextMenu}
        onDragStart={props.onDragStart}
        onDragMove={props.onDragMove}
        onDragEnd={props.onDragEnd}
      />
      {children}
    </Group>
  );
}

/** Renders the hierarchical scene graph. Lines at root; frames as Groups with children. */
export function BoardSceneGraph(props: SceneGraphProps) {
  const { objects, viewport, stageWidth, stageHeight } = props;
  const roots = getRootObjects(objects);
  const worldMargin = CULL_MARGIN_SCREEN_PX / Math.max(viewport.scale, 0.01);
  const viewportBounds: ViewportWorldBounds = {
    minX: (-viewport.x) / viewport.scale - worldMargin,
    minY: (-viewport.y) / viewport.scale - worldMargin,
    maxX: (stageWidth - viewport.x) / viewport.scale + worldMargin,
    maxY: (stageHeight - viewport.y) / viewport.scale + worldMargin,
  };
  const alwaysVisibleIds = new Set<string>(props.selection);
  if (props.hoveredId) alwaysVisibleIds.add(props.hoveredId);
  if (props.draggingId) alwaysVisibleIds.add(props.draggingId);
  if (props.dropTargetFrameId) alwaysVisibleIds.add(props.dropTargetFrameId);
  if (props.draggingId) {
    for (const r of roots) {
      if (r.type === "frame") alwaysVisibleIds.add(r.id);
    }
  }
  const absCache = new Map<string, { x: number; y: number }>();

  // Frames always render first (behind shapes); then selected on top of unselected
  const unselectedRoots = roots.filter((o) => !props.selection.includes(o.id));
  const selectedRoots = roots.filter((o) => props.selection.includes(o.id));
  const sortFramesFirst = (a: (typeof roots)[0], b: (typeof roots)[0]) =>
    (a.type === "frame" ? 0 : 1) - (b.type === "frame" ? 0 : 1);
  let renderOrder: (typeof roots)[0][] = [
    ...unselectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...unselectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
  ];
  // Elevate the actively dragged object to the very top so it draws opaque over others
  if (props.draggingId) {
    const dragged = renderOrder.find((o) => o.id === props.draggingId);
    if (dragged) {
      renderOrder = renderOrder.filter((o) => o.id !== props.draggingId);
      renderOrder.push(dragged);
    }
  }

  return (
    <>
      {renderOrder.map((obj) => renderNode(obj, props, viewportBounds, alwaysVisibleIds, absCache))}
    </>
  );
}
