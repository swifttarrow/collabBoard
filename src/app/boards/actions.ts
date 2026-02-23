"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function updateBoardTitle(boardId: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const trimmed = title.trim() || "Untitled board";

  const { error } = await supabase
    .from("boards")
    .update({ title: trimmed })
    .eq("id", boardId);

  if (error) {
    if (error.code === "42501" || error.message?.includes("policy")) {
      return { error: "Only the board owner can edit the board name." };
    }
    console.error("updateBoardTitle error", error);
    return { error: error.message };
  }

  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
  return { success: true, title: trimmed };
}

export async function deleteBoard(boardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("boards").delete().eq("id", boardId);

  if (error) {
    if (error.code === "42501" || error.message?.includes("policy")) {
      return { error: "Only the board owner can delete this board." };
    }
    console.error("deleteBoard error", error);
    return { error: error.message };
  }

  revalidatePath("/boards");
  return { success: true };
}
