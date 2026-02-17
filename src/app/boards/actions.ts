"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function generateInviteCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInviteLink(boardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = generateInviteCode();

  const { error } = await supabase
    .from("boards")
    .update({ invite_code: code })
    .eq("id", boardId)
    .eq("owner_id", user.id);

  if (error) {
    console.error("createInviteLink error", error);
    return { error: error.message };
  }

  revalidatePath(`/boards/${boardId}`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { inviteUrl: `${baseUrl}/join?code=${code}` };
}

export async function joinBoardByInviteCode(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: boardId, error } = await supabase.rpc("join_board_by_invite", {
    p_invite_code: code.trim().toLowerCase(),
  });

  if (error) {
    console.error("joinBoardByInviteCode error", error);
    return { error: error.message };
  }

  revalidatePath("/boards");
  redirect(`/boards/${boardId}`);
}

export async function createBoard(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = (formData.get("title") as string)?.trim() || "Untitled board";

  const { data, error } = await supabase
    .from("boards")
    .insert({ owner_id: user.id, title })
    .select("id")
    .single();

  if (error) {
    console.error("createBoard error", error);
    return { error: error.message };
  }

  revalidatePath("/boards");
  redirect(`/boards/${data.id}`);
}
