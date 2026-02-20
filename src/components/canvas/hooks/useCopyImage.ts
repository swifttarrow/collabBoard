import { useEffect, useMemo, useState } from "react";
import {
  TRASH_SIZE,
  COPY_STROKE,
  COPY_STROKE_WIDTH,
} from "../constants";

export function useCopyImage(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const dataUrl = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TRASH_SIZE}" height="${TRASH_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${COPY_STROKE}" stroke-width="${COPY_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => setImage(img);
  }, [dataUrl]);

  return image;
}
