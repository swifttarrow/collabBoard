"use client";

import dynamic from "next/dynamic";

const CanvasBoardDynamic = dynamic(
  () => import("./CanvasBoard").then((mod) => mod.CanvasBoard),
  { ssr: false }
);

type Props = { boardId?: string | null };

export function CanvasBoardClient({ boardId = null }: Props) {
  return <CanvasBoardDynamic boardId={boardId} />;
}
