"use client";

import { useState, useEffect } from "react";

/**
 * Renders children only after the component has mounted on the client.
 * Use to avoid hydration mismatches with libraries that generate different
 * IDs or DOM on server vs client (e.g. Radix UI with React 19 useId).
 */
export function MountedOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
