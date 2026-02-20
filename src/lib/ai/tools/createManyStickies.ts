import type OpenAI from "openai";
import type { ToolContext } from "./types";
import { createStickies } from "./createStickies";

const BATCH_SIZE = 25;
const MAX_STICKIES = 100;

export async function createManyStickies(
  ctx: ToolContext,
  openai: OpenAI,
  params: { totalCount: number; topic: string; color?: string },
): Promise<string> {
  const { totalCount, topic, color } = params;

  if (totalCount > MAX_STICKIES) {
    return `Sorry, I can only create up to ${MAX_STICKIES} stickies at a time.`;
  }

  const safeCount = Math.min(Math.max(1, Math.floor(totalCount)), MAX_STICKIES);
  const numBatches = Math.ceil(safeCount / BATCH_SIZE);
  let created = 0;

  try {
    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      const remaining = safeCount - created;
      const batchSize = Math.min(BATCH_SIZE, remaining);
      if (batchSize <= 0) break;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Generate exactly ${batchSize} distinct sticky notes about "${topic}". Each sticky should have unique, varied content (1-2 sentences). Return a JSON object with a "stickies" array. Each item: { "text": "string", "color": "optional string" }. ${color ? `Use color "${color}" for all, or vary between yellow, blue, pink, green.` : "Vary colors: yellow, blue, pink, green."}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      let parsed: { stickies?: Array<{ text?: string; color?: string }> };
      try {
        parsed = JSON.parse(content) as { stickies?: Array<{ text?: string; color?: string }> };
      } catch {
        continue;
      }

      const rawStickies = Array.isArray(parsed.stickies) ? parsed.stickies : [];
      const toCreate = rawStickies
        .slice(0, batchSize)
        .filter((s) => s?.text && typeof s.text === "string")
        .map((s) => ({
          text: s.text!,
          color: color ?? s.color,
        }));

      if (toCreate.length > 0) {
        const result = await createStickies(ctx, { stickies: toCreate });
        if (result.startsWith("Error:")) return result;
        created += toCreate.length;
      }
    }
    return `Created ${created} stickies about "${topic}".`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error: Failed to create stickies. ${msg}`;
  }
}
