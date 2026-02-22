import type { ToolContext } from "./types";
import { createFrame } from "./createFrame";
import { createText } from "./createText";
import { measureTextSnug } from "@/lib/sticky-measure";
import { LABEL_OFFSET_FROM_FRAME } from "../templates/constants";
import { STICKY_FONT_SIZE } from "@/components/canvas/constants";

const FRAME_LABEL_PADDING = 12;
const LABEL_FONT_SIZE_OFFSET = 2;

/**
 * Create a frame with a separate text component labeling its contents.
 * labelPosition: "inside" (default) = label inside frame top, bold; "above" = label above frame.
 */
export async function createLabeledFrame(
  ctx: ToolContext,
  params: {
    label: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    color?: string;
    labelPosition?: "above" | "inside";
    /** When inside, align label horizontally. Default "left". */
    labelAlign?: "left" | "center";
  },
): Promise<{ frameId: string; labelId: string }> {
  const { label, x, y, width, height, color, labelPosition = "inside", labelAlign = "left" } = params;
  const frameHeight = height ?? 200;
  const frameWidth = width ?? 320;
  const labelInside = labelPosition === "inside";

  const labelAboveHeight = labelInside ? 0 : measureTextSnug(label, frameWidth).height;
  const frameY = labelInside ? y : y + labelAboveHeight + LABEL_OFFSET_FROM_FRAME;

  const frameResult = await createFrame(ctx, {
    x,
    y: frameY,
    width: frameWidth,
    height: frameHeight,
    color,
  });

  if (frameResult.startsWith("Error:")) {
    throw new Error(frameResult);
  }
  const frameId = frameResult.match(/Id: ([a-f0-9-]{36})/)?.[1];
  if (!frameId) throw new Error("Failed to get frame id from createFrame");

  if (labelInside) {
    const labelMaxWidth = frameWidth - 2 * FRAME_LABEL_PADDING;
    const { width: labelW, height: labelH } = measureTextSnug(
      `<strong>${label}</strong>`,
      labelMaxWidth
    );
    const labelX =
      labelAlign === "center"
        ? Math.max(0, (frameWidth - labelW) / 2)
        : FRAME_LABEL_PADDING;
    const textResult = await createText(ctx, {
      text: label,
      x: labelX,
      y: FRAME_LABEL_PADDING,
      parentId: frameId,
      bold: true,
      fontSize: STICKY_FONT_SIZE + LABEL_FONT_SIZE_OFFSET,
      width: labelW,
      height: labelH,
      color: "#ffffff",
      borderStyle: "solid",
    });
    const labelId = textResult.match(/Id: ([a-f0-9-]{36})/)?.[1] ?? "";
    return { frameId, labelId };
  }

  const { width: labelW, height: labelH } = measureTextSnug(
    label,
    frameWidth
  );
  const labelX = x + Math.max(0, (frameWidth - labelW) / 2);
  const labelY = y;
  const textResult = await createText(ctx, {
    text: label,
    x: labelX,
    y: labelY,
    width: labelW,
    height: labelH,
    color: "#ffffff",
    borderStyle: "solid",
  });
  const labelId = textResult.match(/Id: ([a-f0-9-]{36})/)?.[1] ?? "";
  return { frameId, labelId };
}
