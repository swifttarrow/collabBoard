"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Group, Path, Text } from "react-konva";
import type Konva from "konva";

type CursorPresence = {
  x: number;
  y: number;
  userId: string;
  color: string;
  name: string;
};

interface CursorPresenceLayerProps {
  cursorsRef: React.RefObject<Record<string, CursorPresence>>;
}

// Lucide MousePointer2 SVG path (24x24 viewBox, tip at ~4,4.7)
const MOUSE_POINTER_PATH =
  "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z";

export function CursorPresenceLayer({ cursorsRef }: CursorPresenceLayerProps) {
  const [display, setDisplay] = useState<Record<string, { x: number; y: number; color: string; name: string }>>({});
  const layerRef = useRef<Konva.Layer>(null);
  const groupRefs = useRef<Record<string, Konva.Group | null>>({});
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let prev: Record<string, { x: number; y: number; color: string; name: string }> = {};
    const tick = () => {
      const cursors = cursorsRef.current ?? {};
      const next: Record<string, { x: number; y: number; color: string; name: string }> = {};
      let structChanged = false;
      for (const [userId, c] of Object.entries(cursors)) {
        const x = c.x;
        const y = c.y;
        next[userId] = { x, y, color: c.color, name: c.name };
        const group = groupRefs.current[userId];
        if (group) {
          group.x(x);
          group.y(y);
        }
      }
      for (const id of Object.keys(prev)) {
        if (!cursors[id]) {
          structChanged = true;
          delete groupRefs.current[id];
        }
      }
      for (const id of Object.keys(cursors)) {
        if (!prev[id]) structChanged = true;
      }
      prev = next;
      if (structChanged) setDisplay(next);
      if (Object.keys(next).length > 0 && layerRef.current) {
        layerRef.current.batchDraw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cursorsRef]);

  const list = Object.entries(display).map(([userId, d]) => ({ userId, ...d }));

  return (
    <Layer ref={layerRef} listening={false}>
      {list.map(({ x, y, color, name, userId }) => (
        <Group
          key={userId}
          ref={(r) => {
            groupRefs.current[userId] = r;
          }}
          x={x}
          y={y}
          listening={false}
        >
          <Path
            data={MOUSE_POINTER_PATH}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
            scaleX={0.75}
            scaleY={0.75}
            offsetX={4.037}
            offsetY={4.688}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
          <Text
            text={name}
            fontSize={12}
            fontFamily="system-ui, sans-serif"
            fill="#1e293b"
            padding={3}
            x={20}
            y={4}
            wrap="none"
            listening={false}
          />
        </Group>
      ))}
    </Layer>
  );
}
