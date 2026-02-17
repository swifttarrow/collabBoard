"use client";

import dynamic from "next/dynamic";

const CanvasBoard = dynamic(
  () =>
    import("../../components/CanvasBoard").then(
      (mod) => mod.CanvasBoard
    ),
  { ssr: false }
);

export default function CanvasPage() {
  return <CanvasBoard />;
}
