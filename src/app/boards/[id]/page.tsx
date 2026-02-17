import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CanvasBoardClient } from "@/components/CanvasBoardClient";

type Props = { params: Promise<{ id: string }> };

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: board, error } = await supabase
    .from("boards")
    .select("id, title")
    .eq("id", id)
    .single();

  if (error || !board) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <Link
          href="/boards"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Boards
        </Link>
        <span className="text-sm text-slate-500">{board.title}</span>
      </header>
      <div className="min-h-0 flex-1">
        <CanvasBoardClient boardId={id} />
      </div>
    </div>
  );
}
