import type { ToolContext } from "./types";
import { createLabeledFrame } from "./createLabeledFrame";
import { createStickyNote } from "./createStickyNote";
import { DEFAULT_FRAME } from "@/components/canvas/constants";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import { DEFAULT_TEXT } from "@/components/canvas/constants";

const JOURNEY_FRAME_GAP = 24;
const JOURNEY_STICKY_GAP = 12;
const STICKIES_PER_STAGE = 5;
const FRAME_PADDING = 16;

const JOURNEY_COLORS = [
  "coral",
  "cyan",
  "mint",
  "fuchsia",
  "peach",
  "slate",
  "blue",
];

/**
 * Create a user journey map: N vertical frames (stages) side by side.
 * Labels default to "Stage 1", "Stage 2", etc. If labels are provided, they are used.
 */
export async function createUserJourneyMap(
  ctx: ToolContext,
  params: {
    columnCount: number;
    labels?: string[];
    centerX: number;
    centerY: number;
  },
): Promise<string> {
  const { columnCount: rawCount, labels, centerX, centerY } = params;
  const columnCount = Math.max(1, Math.min(rawCount ?? 5, 10));

  const frameWidth = Math.max(DEFAULT_FRAME.width, DEFAULT_STICKY.width + FRAME_PADDING * 2);
  const labelHeight = DEFAULT_TEXT.height;
  const stickyStartY = FRAME_PADDING + labelHeight + JOURNEY_STICKY_GAP;
  const frameHeight =
    stickyStartY +
    STICKIES_PER_STAGE * DEFAULT_STICKY.height +
    (STICKIES_PER_STAGE - 1) * JOURNEY_STICKY_GAP +
    FRAME_PADDING;

  const totalFrameWidth =
    columnCount * frameWidth + (columnCount - 1) * JOURNEY_FRAME_GAP;
  const startX = centerX - totalFrameWidth / 2;
  const frameTopY = centerY - frameHeight / 2;

  const createdIds: string[] = [];
  const frameIds: string[] = [];

  for (let i = 0; i < columnCount; i++) {
    const frameX = startX + i * (frameWidth + JOURNEY_FRAME_GAP);
    const label = (labels?.[i]?.trim()) || `Stage ${i + 1}`;
    const result = await createLabeledFrame(ctx, {
      label,
      x: frameX,
      y: frameTopY,
      width: frameWidth,
      height: frameHeight,
      color: JOURNEY_COLORS[i % JOURNEY_COLORS.length] ?? "coral",
      labelPosition: "inside",
      labelAlign: "center",
    });
    frameIds.push(result.frameId);

    for (let s = 0; s < STICKIES_PER_STAGE; s++) {
      const localY = stickyStartY + s * (DEFAULT_STICKY.height + JOURNEY_STICKY_GAP);
      const stickyResult = await createStickyNote(ctx, {
        text: "",
        x: FRAME_PADDING,
        y: localY,
        color: "yellow",
        parentId: result.frameId,
      });
      const id = stickyResult.match(/Id: ([a-f0-9-]{36})/)?.[1];
      if (id) createdIds.push(id);
    }
  }

  const labelSummary =
    Array.isArray(labels) && labels.some((l) => l?.trim())
      ? labels.slice(0, columnCount).map((l, i) => l?.trim() || `Stage ${i + 1}`).join(", ")
      : `Stage 1–${columnCount}`;
  return `Created user journey map with ${columnCount} stages: ${labelSummary}.`;
}
