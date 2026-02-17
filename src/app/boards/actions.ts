"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createInviteLink(boardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .eq("owner_id", user.id)
    .single();

  if (error) {
    console.error("createInviteLink error", error);
    return { error: error.message };
  }

  revalidatePath(`/boards/${boardId}`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { inviteUrl: `${baseUrl}/boards/${boardId}` };
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
