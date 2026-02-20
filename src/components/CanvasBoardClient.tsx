"use client";

import dynamic from "next/dynamic";

const CanvasBoardDynamic = dynamic(
  () => import("./CanvasBoard").then((mod) => mod.CanvasBoard),
  { ssr: false },
);

export type BoardMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Props = { boardId: string };

export function CanvasBoardClient({ boardId }: Props) {
  return <CanvasBoardDynamic boardId={boardId} />;
}
