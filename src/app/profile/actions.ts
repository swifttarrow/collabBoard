"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const ProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
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
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { firstName, lastName } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("updateProfile error", error);
    return { error: error.message };
  }

  return { success: true };
}
