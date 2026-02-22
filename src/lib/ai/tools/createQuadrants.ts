import type { ToolContext } from "./types";
import { createLabeledFrame } from "./createLabeledFrame";
import { createFrame } from "./createFrame";
import { QUADRANT_GAP } from "../templates/constants";
import { DEFAULT_FRAME } from "@/components/canvas/constants";

export type QuadrantLabels = {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
};

/**
 * Create a 2x2 grid of four frames, optionally labeled.
 * Gap between frames is 8px. When labels are provided, they appear inside each frame (bold, +2px font).
 */
export async function createQuadrants(
  ctx: ToolContext,
  params: {
    labels?: QuadrantLabels;
    centerX: number;
    centerY: number;
    quadrantWidth?: number;
    quadrantHeight?: number;
  },
): Promise<string> {
  const {
    labels,
    centerX,
    centerY,
    quadrantWidth = DEFAULT_FRAME.width,
    quadrantHeight = DEFAULT_FRAME.height,
  } = params;

  const g = QUADRANT_GAP;
  const totalW = quadrantWidth * 2 + g;
  const totalH = quadrantHeight * 2 + g;
  const startX = centerX - totalW / 2;
  const startY = centerY - totalH / 2;

  const topLeftX = startX;
  const topLeftY = startY;
  const topRightX = startX + quadrantWidth + g;
  const topRightY = startY;
  const bottomLeftX = startX;
  const bottomLeftY = startY + quadrantHeight + g;
  const bottomRightX = startX + quadrantWidth + g;
  const bottomRightY = startY + quadrantHeight + g;

  const frameIds: string[] = [];

  if (labels) {
    const results = await Promise.all([
      createLabeledFrame(ctx, {
        label: labels.topLeft,
        x: topLeftX,
        y: topLeftY,
        width: quadrantWidth,
        height: quadrantHeight,
        labelPosition: "inside",
      }),
      createLabeledFrame(ctx, {
        label: labels.topRight,
        x: topRightX,
        y: topRightY,
        width: quadrantWidth,
        height: quadrantHeight,
        labelPosition: "inside",
      }),
      createLabeledFrame(ctx, {
        label: labels.bottomLeft,
        x: bottomLeftX,
        y: bottomLeftY,
        width: quadrantWidth,
        height: quadrantHeight,
        labelPosition: "inside",
      }),
      createLabeledFrame(ctx, {
        label: labels.bottomRight,
        x: bottomRightX,
        y: bottomRightY,
        width: quadrantWidth,
        height: quadrantHeight,
        labelPosition: "inside",
      }),
    ]);
    frameIds.push(...results.map((r) => r.frameId));
  } else {
    const positions = [
      { x: topLeftX, y: topLeftY },
      { x: topRightX, y: topRightY },
      { x: bottomLeftX, y: bottomLeftY },
      { x: bottomRightX, y: bottomRightY },
    ];
    for (const pos of positions) {
      const result = await createFrame(ctx, {
        x: pos.x,
        y: pos.y,
        width: quadrantWidth,
        height: quadrantHeight,
      });
      const id = result.match(/Id: ([a-f0-9-]{36})/)?.[1];
      if (id) frameIds.push(id);
    }
  }

  return labels
    ? `Created quadrant layout. Quadrants: ${labels.topLeft}, ${labels.topRight}, ${labels.bottomLeft}, ${labels.bottomRight}.`
    : `Created 2x2 quadrant grid (4 frames).`;
}
