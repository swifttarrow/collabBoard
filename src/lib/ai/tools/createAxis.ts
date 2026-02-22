import type { ToolContext } from "./types";
import { createLine } from "./createLine";
import { createText } from "./createText";

export type AxisLabelPosition =
  | "top-left"
  | "top-middle"
  | "top-right"
  | "bottom-left"
  | "bottom-middle"
  | "bottom-right";

const LABEL_OFFSET = 24;

/**
 * Compute perpendicular unit vector (for "above" the line).
 * Axis from (sx,sy) -> (ex,ey). Returns unit vector pointing "above" (left of direction).
 */
function perpendicularUp(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x: number; y: number } {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/**
 * Get label position (x, y) for the given position enum.
 */
function getLabelPosition(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  position: AxisLabelPosition,
): { x: number; y: number } {
  const perp = perpendicularUp(startX, startY, endX, endY);

  const quarter = 0.25;
  const threeQuarter = 0.75;

  let t: number;
  switch (position) {
    case "top-left":
    case "bottom-left":
      t = quarter;
      break;
    case "top-middle":
    case "bottom-middle":
      t = 0.5;
      break;
    case "top-right":
    case "bottom-right":
      t = threeQuarter;
      break;
    default:
      t = 0.5;
  }

  const offsetMult = position.startsWith("top") ? -1 : 1;
  const labelX = startX + (endX - startX) * t + perp.x * LABEL_OFFSET * offsetMult;
  const labelY = startY + (endY - startY) * t + perp.y * LABEL_OFFSET * offsetMult;

  return { x: labelX, y: labelY };
}

/**
 * Create an axis: arrow line + optional text label.
 * Label can be placed in 6 areas: top-left, top-middle, top-right, bottom-left, bottom-middle, bottom-right.
 */
export async function createAxis(
  ctx: ToolContext,
  params: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    label?: string;
    labelPosition?: AxisLabelPosition;
    color?: string;
  },
): Promise<string> {
  const { startX, startY, endX, endY, label, labelPosition, color } = params;
  const defaultPosition: AxisLabelPosition = "top-middle";

  await createLine(ctx, {
    startX,
    startY,
    endX,
    endY,
    startCap: "point",
    endCap: "arrow",
    color: color ?? "#64748b",
  });

  if (label?.trim()) {
    const pos = labelPosition ?? defaultPosition;
    const { x, y } = getLabelPosition(startX, startY, endX, endY, pos);
    await createText(ctx, { text: label, x, y });
  }

  return `Created axis from (${startX}, ${startY}) to (${endX}, ${endY})${label ? ` with label "${label}"` : ""}.`;
}
