import { generateObject, type LanguageModelV1 } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types";
import { createStickies } from "./createStickies";

const BATCH_SIZE = 25;
const STICKY_SCHEMA = z.object({
  text: z.string().describe("Content for this sticky (concise: 1-2 sentences)"),
  color: z.string().optional().describe("Color: yellow, blue, pink, green, or hex"),
});

/**
 * Create many stickies in one shot. Generates content per batch via LLM,
 * loops through batches, calls createStickies for each. Positioning is
 * automatic (each batch goes below the previous).
 */
export async function createManyStickies(
  ctx: ToolContext,
  model: LanguageModelV1,
  params: { totalCount: number; topic: string; color?: string }
): Promise<string> {
  const { totalCount, topic, color } = params;
  const safeCount = Math.min(Math.max(1, Math.floor(totalCount)), 100);

  const numBatches = Math.ceil(safeCount / BATCH_SIZE);
  let created = 0;

  for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
    const remaining = safeCount - created;
    const batchSize = Math.min(BATCH_SIZE, remaining);
    if (batchSize <= 0) break;

    const { object: stickies } = await generateObject({
      model,
      output: "array" as const,
      schema: STICKY_SCHEMA,
      schemaName: "sticky",
      schemaDescription: "A sticky note with text and optional color",
      prompt: `Generate exactly ${batchSize} distinct sticky notes about "${topic}". Each sticky should have unique, varied content (1-2 sentences). ${color ? `Use color "${color}" for all, or vary between yellow, blue, pink, green.` : "Vary colors: yellow, blue, pink, green."}`,
    });

    const toCreate = (stickies ?? [])
      .slice(0, batchSize)
      .filter((s) => s?.text && typeof s.text === "string")
      .map((s) => ({ text: s.text!, color: s.color ?? color }));

    if (toCreate.length > 0) {
      await createStickies(ctx, { stickies: toCreate });
      created += toCreate.length;
    }
  }

  return `Created ${created} stickies about "${topic}".`;
}
