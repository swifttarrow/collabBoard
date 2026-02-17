import { Suspense } from "react";
import SignUpClient from "./SignUpClient";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50" />}>
      <SignUpClient />
    </Suspense>
  );
}
