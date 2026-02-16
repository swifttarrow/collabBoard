"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "../lib/board/store";
import type { BoardObject } from "../lib/board/types";

const DEFAULT_STICKY = { width: 180, height: 120 };
const DEFAULT_RECT = { width: 220, height: 140 };

const COLORS = ["#FDE68A", "#FCA5A5", "#BFDBFE", "#BBF7D0", "#E9D5FF"];

export function BoardCanvasLocal() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const viewport = useBoardStore((state) => state.viewport);
  const addObject = useBoardStore((state) => state.addObject);
  const updateObject = useBoardStore((state) => state.updateObject);
  const removeObject = useBoardStore((state) => state.removeObject);
  const setSelection = useBoardStore((state) => state.setSelection);
  const setViewport = useBoardStore((state) => state.setViewport);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const center = useMemo(() => {
    return {
      x: -viewport.x + dimensions.width / 2,
      y: -viewport.y + dimensions.height / 2,
    };
  }, [dimensions, viewport]);

  const createSticky = useCallback(
    (color: string) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "sticky",
        x: center.x - DEFAULT_STICKY.width / 2,
        y: center.y - DEFAULT_STICKY.height / 2,
        width: DEFAULT_STICKY.width,
        height: DEFAULT_STICKY.height,
        rotation: 0,
        color,
        text: "New note",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, center, setSelection]
  );

  const createRect = useCallback(
    (color: string) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "rect",
        x: center.x - DEFAULT_RECT.width / 2,
        y: center.y - DEFAULT_RECT.height / 2,
        width: DEFAULT_RECT.width,
        height: DEFAULT_RECT.height,
        rotation: 0,
        color,
        text: "",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, center, setSelection]
  );

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = event.target.getStage();
    if (!stage) return;

    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };

    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const target = event.target;
    if (target && target.name()) {
      const id = target.name();
      updateObject(id, { x: target.x(), y: target.y() });
    }
  };

  const handleStageDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    setViewport({
      x: event.target.x(),
      y: event.target.y(),
      scale: viewport.scale,
    });
  };

  const handleDelete = () => {
    if (!selection) return;
    removeObject(selection);
    setSelection(null);
  };

  const handleColor = (color: string) => {
    if (!selection) return;
    updateObject(selection, { color });
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          background: "rgba(15, 23, 42, 0.8)",
          border: "1px solid rgba(226, 232, 240, 0.2)",
          borderRadius: 16,
          padding: "12px 16px",
          color: "#e2e8f0",
        }}
      >
        <button
          type="button"
          style={buttonStyle}
          onClick={() => createSticky(COLORS[0])}
        >
          Sticky
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, background: "transparent", color: "#e2e8f0" }}
          onClick={() => createRect(COLORS[2])}
        >
          Rectangle
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, background: "transparent", color: "#e2e8f0" }}
          onClick={handleDelete}
        >
          Delete
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColor(color)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                border: "1px solid rgba(226, 232, 240, 0.3)",
                background: color,
              }}
            />
          ))}
        </div>
      </div>

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onMouseDown={() => setSelection(null)}
      >
        <Layer>
          {Object.values(objects).map((object) => {
            if (object.type === "rect") {
              return (
                <Rect
                  key={object.id}
                  name={object.id}
                  x={object.x}
                  y={object.y}
                  width={object.width}
                  height={object.height}
                  fill={object.color}
                  cornerRadius={10}
                  draggable
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelection(object.id)}
                />
              );
            }

            return (
              <Group
                key={object.id}
                name={object.id}
                x={object.x}
                y={object.y}
                draggable
                onDragEnd={handleDragEnd}
                onClick={() => setSelection(object.id)}
                onDblClick={() => {
                  const next = window.prompt("Edit text", object.text);
                  if (next !== null) {
                    updateObject(object.id, { text: next });
                  }
                }}
              >
                <Rect
                  width={object.width}
                  height={object.height}
                  fill={object.color}
                  cornerRadius={14}
                  shadowColor="#000"
                  shadowBlur={8}
                  shadowOpacity={0.2}
                />
                <Text
                  text={object.text}
                  fill="#1e293b"
                  fontSize={16}
                  width={object.width}
                  height={object.height}
                  padding={12}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 12,
  border: "none",
  cursor: "pointer",
};
