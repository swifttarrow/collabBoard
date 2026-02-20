"use client";

import { useCallback } from "react";
import { Group } from "react-konva";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getRootObjects, getChildren } from "@/lib/board/scene-graph";
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
  trashImage: HTMLImageElement | null;
  copyImage: HTMLImageElement | null;
  registerNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
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
  onStartEdit: (id: string) => void;
};

function renderNode(object: BoardObjectWithMeta, props: SceneGraphProps): React.ReactNode {
  const {
    objects,
    selection,
    hoveredId,
    activeTool,
    draggingId,
    trashImage,
    copyImage,
    registerNodeRef,
    onSelect,
    onHover,
    onDelete,
    onDuplicate,
    onColorChange,
    onCustomColor,
    onDragStart,
    onDragMove,
    onDragEnd,
    onLineAnchorMove,
    onLineAnchorDrop,
    onLineMove,
    onStartEdit,
  } = props;
  const isSelected = selection.includes(object.id);
  const showControls =
    selection.length === 1 && isSelected && hoveredId === object.id;
  const draggable = activeTool === "select";
  const common = {
    isSelected,
    showControls,
    draggable,
    trashImage,
    copyImage,
    registerNodeRef,
    onSelect,
    onHover,
    onDelete,
    onDuplicate,
    onColorChange,
    onCustomColor,
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
    return (
      <FrameGroup
        key={object.id}
        object={object as BoardObject & { type: "frame" }}
        props={props}
        isDropTarget={props.dropTargetFrameId === object.id}
      >
        {children.map((child) => renderNode(child, props))}
      </FrameGroup>
    );
  }
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
        onAnchorMove={onLineAnchorMove}
        onAnchorDrop={onLineAnchorDrop}
        onLineMove={onLineMove}
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
  const { selection, hoveredId, activeTool, onDragStart, onDragEnd } = props;
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
        draggable={false}
        trashImage={props.trashImage}
        copyImage={props.copyImage}
        registerNodeRef={props.registerNodeRef}
        onSelect={props.onSelect}
        onHover={props.onHover}
        onDelete={props.onDelete}
        onDuplicate={props.onDuplicate}
        onColorChange={props.onColorChange}
        onCustomColor={props.onCustomColor}
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
  const { objects } = props;
  const roots = getRootObjects(objects);

  // Frames always render first (behind shapes); then selected on top of unselected
  const unselectedRoots = roots.filter((o) => !props.selection.includes(o.id));
  const selectedRoots = roots.filter((o) => props.selection.includes(o.id));
  const sortFramesFirst = (a: (typeof roots)[0], b: (typeof roots)[0]) =>
    (a.type === "frame" ? 0 : 1) - (b.type === "frame" ? 0 : 1);
  const renderOrder = [
    ...unselectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...unselectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
  ];

  return (
    <>
      {renderOrder.map((obj) => renderNode(obj, props))}
    </>
  );
}
