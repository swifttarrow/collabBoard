import type { ToolContext } from "./types";
import { createShape } from "./createShape";
import { createConnector } from "./createConnector";

export async function createShapesAndConnect(
  ctx: ToolContext,
  params: {
    type1: "rect" | "circle";
    type2: "rect" | "circle";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    connectorStyle?: "both" | "left" | "right" | "none";
    size?: number;
  }
): Promise<string> {
  const size = params.size ?? 80;
  const r1 = await createShape(ctx, {
    type: params.type1,
    x: params.x1,
    y: params.y1,
    width: size,
    height: size,
  });
  const r2 = await createShape(ctx, {
    type: params.type2,
    x: params.x2,
    y: params.y2,
    width: size,
    height: size,
  });
  const idMatch = /Id: ([a-f0-9-]+)/i;
  const id1 = r1.match(idMatch)?.[1];
  const id2 = r2.match(idMatch)?.[1];
  if (!id1 || !id2) return `${r1}\n${r2}\nError: Could not parse created shape ids`;
  const r3 = await createConnector(ctx, {
    fromId: id1,
    toId: id2,
    style: params.connectorStyle ?? "both",
  });
  return `${r1}\n${r2}\n${r3}`;
}
