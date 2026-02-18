"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatarColor: z.enum([
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  ]).optional(),
});

export type ProfileFormState = {
  error?: string;
  success?: boolean;
};

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = ProfileSchema.safeParse({
    firstName: (formData.get("firstName") as string)?.trim() || undefined,
    lastName: (formData.get("lastName") as string)?.trim() || undefined,
    avatarColor: (formData.get("avatarColor") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { firstName, lastName, avatarColor } = parsed.data;

  const updateData: Record<string, unknown> = {
    id: user.id,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    updated_at: new Date().toISOString(),
  };
  if (avatarColor) {
    updateData.avatar_color = avatarColor;
  }

  let { error } = await supabase
    .from("profiles")
    .upsert(updateData, { onConflict: "id" });

  if (error?.code === "42703" && avatarColor) {
    delete updateData.avatar_color;
    const result = await supabase
      .from("profiles")
      .upsert(updateData, { onConflict: "id" });
    error = result.error;
  }

  if (error) {
    console.error("updateProfile error", error);
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
