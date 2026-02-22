/**
 * Resilient Canvas: API route for submitting ops with idempotency.
 * Applies ops via Postgres function, returns new revision.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const OpSchema = z.object({
  opId: z.string().uuid(),
  clientId: z.string(),
  boardId: z.string().uuid(),
  timestamp: z.number(),
  baseRevision: z.number(),
  type: z.enum(["create", "update", "delete"]),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string(),
});

const BodySchema = z.object({
  op: OpSchema,
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boardId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await _req.json();
  } catch (err) {
    console.error("[boards/ops] Request body JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid op", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { op } = parsed.data;
  if (op.boardId !== boardId) {
    return NextResponse.json(
      { error: "Board ID mismatch" },
      { status: 400 }
    );
  }

  const payload = toDbPayload(op.type, op.payload);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid payload for op type" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("apply_board_operation", {
    p_op_id: op.opId,
    p_board_id: boardId,
    p_op_type: op.type,
    p_payload: payload,
  });

  if (error) {
    if (error.code === "42501" || error.message?.includes("Access denied")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
      const result = data as { revision?: number } | null;
      return NextResponse.json({
        applied: false,
        revision: result?.revision ?? 0,
      });
    }
    return NextResponse.json(
      { error: error.message || "Failed to apply op" },
      { status: 500 }
    );
  }

  const result = data as { applied?: boolean; revision?: number };
  return NextResponse.json({
    applied: result.applied ?? true,
    revision: result.revision ?? 0,
  });
}

function toDbPayload(
  type: string,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  switch (type) {
    case "create": {
      const obj = payload as Record<string, unknown>;
      return {
        id: obj.id,
        type: obj.type,
        data: obj.data ?? {},
        parent_id: obj.parentId ?? null,
        x: obj.x ?? 0,
        y: obj.y ?? 0,
        width: obj.width ?? 0,
        height: obj.height ?? 0,
        rotation: obj.rotation ?? 0,
        color: obj.color ?? null,
        text: obj.text ?? null,
        clip_content: obj.clipContent ?? false,
      };
    }
    case "update": {
      const obj = payload as Record<string, unknown>;
      const out: Record<string, unknown> = { id: obj.id };
      if (obj.parentId !== undefined) out.parent_id = obj.parentId;
      if (obj.x !== undefined) out.x = obj.x;
      if (obj.y !== undefined) out.y = obj.y;
      if (obj.width !== undefined) out.width = obj.width;
      if (obj.height !== undefined) out.height = obj.height;
      if (obj.rotation !== undefined) out.rotation = obj.rotation;
      if (obj.color !== undefined) out.color = obj.color;
      if (obj.text !== undefined) out.text = obj.text;
      if (obj.clipContent !== undefined) out.clip_content = obj.clipContent;
      if (obj.data !== undefined) out.data = obj.data;
      return out;
    }
    case "delete":
      return { id: (payload as { id: string }).id };
    default:
      return null;
  }
}
