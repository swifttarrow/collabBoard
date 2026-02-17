import { useEffect, useMemo, useState } from "react";
import {
  TRASH_SIZE,
  TRASH_STROKE,
  TRASH_STROKE_WIDTH,
} from "../constants";

export function useTrashImage(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const dataUrl = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TRASH_SIZE}" height="${TRASH_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${TRASH_STROKE}" stroke-width="${TRASH_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => setImage(img);
  }, [dataUrl]);

  return image;
}
