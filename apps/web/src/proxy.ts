import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/blog-admin-auth";

// Gates every /blog-admin page except the login page itself. See
// lib/blog-admin-auth.ts for the (deliberately simple) session model.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/blog-admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/blog-admin/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/blog-admin/:path*"],
};
