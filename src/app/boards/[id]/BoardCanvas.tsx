"use client";

import dynamic from "next/dynamic";

const CanvasBoard = dynamic(
  () => import("@/components/CanvasBoard").then((mod) => mod.CanvasBoard),
  { ssr: false }
);

type Props = { boardId: string };

export function BoardCanvas({ boardId: _boardId }: Props) {
  return <CanvasBoard />;
}
