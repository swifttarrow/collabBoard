import type OpenAI from "openai";
import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { clusterStickiesByQuadrant } from "./clusterStickiesByQuadrant";

const BATCH_SIZE = 25;

/**
 * Cluster stickies into quadrants using AI to score each sticky.
 * Use when the user wants to classify stickies into four quadrants (e.g. time vs impact)
 * but hasn't provided scores - the LLM scores them internally.
 */
export async function clusterStickiesByQuadrantWithAI(
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

  const allPlacements: Array<{ stickyId: string; xScore: number; yScore: number }> = [];

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
          content: `You are scoring sticky notes for a quadrant chart (2x2 grid).

X axis: ${xDesc} (use -5 to 5: negative = left quadrants, positive = right quadrants)
Y axis: ${yDesc} (use -5 to 5: negative = bottom quadrants, positive = top quadrants)

Ties round up: 0 counts as positive. Score each sticky. Return a JSON object with a "placements" array. Each item: { "stickyId": "<exact id from input>", "xScore": number, "yScore": number }.

Stickies to score:
${JSON.stringify(items, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) continue;

    let parsed: {
      placements?: Array<{ stickyId?: string; xScore?: number; yScore?: number }>;
    };
    try {
      parsed = JSON.parse(content) as {
        placements?: Array<{ stickyId?: string; xScore?: number; yScore?: number }>;
      };
    } catch {
      continue;
    }

    const raw = Array.isArray(parsed.placements) ? parsed.placements : [];
    for (const p of raw) {
      if (
        p?.stickyId &&
        typeof p.xScore === "number" &&
        typeof p.yScore === "number"
      ) {
        allPlacements.push({
          stickyId: p.stickyId,
          xScore: p.xScore,
          yScore: p.yScore,
        });
      }
    }
  }

  if (allPlacements.length === 0) {
    return "Failed to score stickies for quadrants.";
  }

  return clusterStickiesByQuadrant(ctx, {
    xAxisLabel: params.xAxisLabel,
    yAxisLabel: params.yAxisLabel,
    placements: allPlacements,
  });
}
