const protectedPaths = ["/boards"];
const authPaths = ["/login", "/signup", "/auth"];

export function isProtected(pathname: string) {
  return protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isAuthPath(pathname: string) {
  return authPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
