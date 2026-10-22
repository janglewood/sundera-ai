import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/blog-admin-auth";

const intlMiddleware = createIntlMiddleware(routing);

// Gates every /blog-admin page except the login page itself. See
// lib/blog-admin-auth.ts for the (deliberately simple) session model.
// /blog-admin lives outside the [locale] segment (it's an internal tool,
// not translated), so it's handled here before falling through to the
// locale-detection/rewrite middleware for every other route.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/blog-admin")) {
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

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
