import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { useBoardStore } from "@/lib/board/store";

type UseViewportParams = {
  followingUserId?: string | null;
  unfollowUser?: () => void;
};

export function useViewport(params: UseViewportParams = {}) {
  const { followingUserId, unfollowUser } = params;
  const viewport = useBoardStore((state) => state.viewport);
  const setViewport = useBoardStore((state) => state.setViewport);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  function getWorldPoint(stage: Konva.Stage, pointer: { x: number; y: number }) {
    const current = viewportRef.current;
    return {
      x: (pointer.x - current.x) / current.scale,
      y: (pointer.y - current.y) / current.scale,
    };
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    if (followingUserId && unfollowUser) unfollowUser();
    const { deltaX, deltaY, ctrlKey, metaKey } = event.evt;
    const isPinchZoom = ctrlKey || metaKey;

    if (isPinchZoom) {
      // Pinch or ctrl+scroll: zoom
      const scaleBy = 1.05;
      const stage = event.target.getStage();
      if (!stage) return;

      const oldScale = viewportRef.current.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - viewportRef.current.x) / oldScale,
        y: (pointer.y - viewportRef.current.y) / oldScale,
      };

      const direction = deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
    } else {
      // Two-finger scroll: pan
      const current = viewportRef.current;
      setViewport({
        x: current.x - deltaX,
        y: current.y - deltaY,
        scale: current.scale,
      });
    }
  }

  function startPan(pointer: { x: number; y: number }) {
    if (followingUserId && unfollowUser) unfollowUser();
    setIsPanning(true);
    lastPanPosRef.current = pointer;
  }

  function panMove(pointer: { x: number; y: number }) {
    if (!isPanning || !lastPanPosRef.current) return;
    const dx = pointer.x - lastPanPosRef.current.x;
    const dy = pointer.y - lastPanPosRef.current.y;
    lastPanPosRef.current = pointer;
    const current = viewportRef.current;
    setViewport({ x: current.x + dx, y: current.y + dy, scale: current.scale });
  }

  function endPan() {
    setIsPanning(false);
    lastPanPosRef.current = null;
  }

  return {
    viewport,
    handleWheel,
    getWorldPoint,
    startPan,
    panMove,
    endPan,
    isPanning,
  };
}
