"use client";

import dynamic from "next/dynamic";

const BoardCanvasLocal = dynamic(
  () =>
    import("../../components/BoardCanvasLocal").then(
      (mod) => mod.BoardCanvasLocal
    ),
  { ssr: false }
);

export default function CanvasPage() {
  return <BoardCanvasLocal />;
}
