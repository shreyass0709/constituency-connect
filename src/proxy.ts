import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed Middleware → Proxy. This is the *optimistic* check only: is there a
// session cookie at all. It never reads the DB and never decides roles — every
// protected layout calls requireUser() and every mutation goes through defineAction.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/office/:path*", "/department/:path*", "/field/:path*", "/onboarding"],
};
