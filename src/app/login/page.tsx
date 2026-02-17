import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50" />}>
      <LoginClient />
    </Suspense>
  );
}
