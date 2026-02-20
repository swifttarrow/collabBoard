import type { ToolContext } from "./types";

/**
 * Zoom the viewport. Broadcasts to client for smooth incremental animation.
 * Use when user asks to "zoom in", "zoom out", "zoom to fit", etc.
 */
export async function zoomViewport(
  ctx: ToolContext,
  params: { direction?: "in" | "out"; factor?: number }
): Promise<string> {
  const broadcast = ctx.broadcastViewportCommand;
  if (!broadcast) {
    return "Zoom is not available in this context.";
  }

  const factor =
    params.factor ??
    (params.direction === "in" ? 1.25 : params.direction === "out" ? 0.8 : 1);
  if (factor <= 0) {
    return "Error: zoom factor must be positive.";
  }

  broadcast({ action: "zoomBy", factor });
  return `Zooming ${factor > 1 ? "in" : "out"} (factor ${factor.toFixed(2)}).`;
}
