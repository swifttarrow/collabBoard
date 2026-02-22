import type { ToolContext } from "./types";
import { createQuadrants } from "./createQuadrants";

/**
 * Create a SWOT analysis template with four quadrants:
 * Strengths (top-left), Weaknesses (top-right), Opportunities (bottom-left), Threats (bottom-right).
 * Centered on viewport.
 */
export async function createSWOT(
  ctx: ToolContext,
  params: {
    centerX: number;
    centerY: number;
  },
): Promise<string> {
  return createQuadrants(ctx, {
    labels: {
      topLeft: "Strengths",
      topRight: "Weaknesses",
      bottomLeft: "Opportunities",
      bottomRight: "Threats",
    },
    centerX: params.centerX,
    centerY: params.centerY,
  });
}
