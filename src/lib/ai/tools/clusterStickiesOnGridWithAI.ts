import type OpenAI from "openai";
import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { clusterStickiesOnGrid } from "./clusterStickiesOnGrid";

const BATCH_SIZE = 25;

/**
 * Cluster stickies on an x/y grid using AI to score each sticky.
 * Use when the user wants to classify stickies on a 2D graph (e.g. time vs impact)
 * but hasn't provided scores - the LLM scores them internally.
 */
export async function clusterStickiesOnGridWithAI(
  ctx: ToolContext,
  openai: OpenAI,
  params: {
    xAxisLabel: string;
    yAxisLabel: string;
    xAxisDescription?: string;
    yAxisDescription?: string;
  },
): Promise<string> {
  await getBoardState(ctx);

  const stickies = Object.values(ctx.objects).filter(
    (o) => (o as { type?: string }).type === "sticky",
  );
  if (stickies.length === 0) {
    return "No stickies on the board to cluster. Create stickies first.";
  }

  const xDesc = params.xAxisDescription ?? params.xAxisLabel;
  const yDesc = params.yAxisDescription ?? params.yAxisLabel;

  const allPlacements: Array<{ stickyId: string; x: number; y: number }> = [];

  for (let i = 0; i < stickies.length; i += BATCH_SIZE) {
    const batch = stickies.slice(i, i + BATCH_SIZE);
    const items = batch.map((s) => ({
      id: s.id,
      text: (s as { text?: string }).text?.slice(0, 200) ?? "",
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are scoring sticky notes on two axes for a 2D graph.

X axis: ${xDesc} (use 1-10: 1-5 = left, 6-10 = right)
Y axis: ${yDesc} (use 1-10: 1-5 = bottom, 6-10 = top)

Score each sticky. Return a JSON object with a "placements" array. Each item: { "stickyId": "<exact id from input>", "x": number, "y": number }.

Stickies to score:
${JSON.stringify(items, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) continue;

    let parsed: { placements?: Array<{ stickyId?: string; x?: number; y?: number }> };
    try {
      parsed = JSON.parse(content) as {
        placements?: Array<{ stickyId?: string; x?: number; y?: number }>;
      };
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[clusterStickiesOnGridWithAI] LLM response parse failed:", content?.slice(0, 100), err);
      }
      continue;
    }

    const raw = Array.isArray(parsed.placements) ? parsed.placements : [];
    for (const p of raw) {
      if (
        p?.stickyId &&
        typeof p.x === "number" &&
        typeof p.y === "number"
      ) {
        allPlacements.push({
          stickyId: p.stickyId,
          x: p.x,
          y: p.y,
        });
      }
    }
  }

  if (allPlacements.length === 0) {
    return "Failed to score stickies for the grid.";
  }

  return clusterStickiesOnGrid(ctx, {
    xAxisLabel: params.xAxisLabel,
    yAxisLabel: params.yAxisLabel,
    placements: allPlacements,
  });
}
