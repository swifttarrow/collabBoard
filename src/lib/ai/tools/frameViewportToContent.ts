import type { ToolContext } from "./types";

/**
 * Frame the viewport to fit all content. Broadcasts to client for smooth animation.
 * Use when user asks to "zoom to fit", "show everything", "frame the board", etc.
 */
export async function frameViewportToContent(ctx: ToolContext): Promise<string> {
  const broadcast = ctx.broadcastViewportCommand;
  if (!broadcast) {
    return "Frame to content is not available in this context.";
  }

  broadcast({ action: "frameToContent" });
  return "Framing view to fit all content.";
}
