import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <main className="max-w-[400px] text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Board not found</h1>
        <p className="mt-2 text-slate-600">
          This board doesn’t exist or you don’t have access to it.
        </p>
        <Link
          href="/boards"
          className="mt-6 inline-block rounded-full bg-slate-200 px-[18px] py-[10px] text-sm font-semibold text-slate-900"
        >
          Back to Boards
        </Link>
      </main>
    </div>
  );
}
