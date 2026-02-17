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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

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
          defaultFirstName={profile?.first_name ?? ""}
          defaultLastName={profile?.last_name ?? ""}
        />
      </main>
    </div>
  );
}
