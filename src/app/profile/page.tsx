import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: initialProfile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_color")
    .eq("id", user.id)
    .single();

  let profile = initialProfile;
  if (profileError?.code === "42703") {
    profile = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()
      .then((r) => r.data);
  } else if (profileError) {
    console.error("[ProfilePage] profile fetch error:", profileError);
  }

  if (!profile) {
    const { data: inserted } = await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id" })
      .select("first_name, last_name")
      .single();
    profile = inserted ?? { first_name: null, last_name: null };
  }

  const hasAvatarColor = !!profile && "avatar_color" in profile;

  const defaultFirstName = profile?.first_name ?? "";
  const defaultLastName = profile?.last_name ?? "";
  const defaultAvatarColor = hasAvatarColor ? (profile as { avatar_color?: string | null })?.avatar_color ?? null : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/boards" className="text-sm font-semibold text-slate-900">
            COLLABBOARD
          </Link>
          <Link
            href="/boards"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Boards
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Optionally add your name. It will be used for your avatar on boards.
        </p>
        <ProfileForm
          key={`${defaultFirstName}-${defaultLastName}-${defaultAvatarColor ?? ""}`}
          email={user.email ?? ""}
          defaultFirstName={defaultFirstName}
          defaultLastName={defaultLastName}
          defaultAvatarColor={defaultAvatarColor}
        />
      </main>
    </div>
  );
}
