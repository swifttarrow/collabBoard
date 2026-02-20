import type { ToolContext } from "./types";

/**
 * Pan the viewport. Broadcasts to client for smooth incremental animation.
 * Use when user asks to "pan left", "pan right", "move view", etc.
 */
export async function panViewport(
  ctx: ToolContext,
  params: { deltaX: number; deltaY: number }
): Promise<string> {
  const broadcast = ctx.broadcastViewportCommand;
  if (!broadcast) {
    return "Pan is not available in this context.";
  }

  broadcast({ action: "pan", deltaX: params.deltaX, deltaY: params.deltaY });
  return `Panned by (${params.deltaX}, ${params.deltaY}).`;
}
