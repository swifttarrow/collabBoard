import type { ToolContext } from "./types";

/**
 * Pan the viewport so a world point is centered, and clamp zoom to min/max.
 * Broadcasts zoomToPoint for the client to animate.
 */
export async function zoomTo(
  ctx: ToolContext,
  params: {
    x: number;
    y: number;
    minZoom?: number;
    maxZoom?: number;
  }
): Promise<string> {
  const broadcast = ctx.broadcastViewportCommand;
  if (!broadcast) {
    return "Zoom is not available in this context.";
  }

  const minZoom = params.minZoom ?? 50;
  const maxZoom = params.maxZoom ?? 100;

  broadcast({
    action: "zoomToPoint",
    x: params.x,
    y: params.y,
    minZoom,
    maxZoom,
  });

  return `Panned to center (${params.x}, ${params.y}), zoom clamped to ${minZoom}-${maxZoom}%.`;
}
