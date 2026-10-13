// blog-admin's password gate. Deliberately simple/stateless — one shared
// password (BLOG_ADMIN_PASSWORD, set in Railway), no user accounts, no
// server-side session store: the session cookie IS a hash of the password,
// so any request that holds it is proof the browser once knew the password.
// Uses Web Crypto (not Node's `crypto`) so this also works unmodified if
// middleware.ts ever runs on the Edge runtime.

export const SESSION_COOKIE = "blog_admin_session";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Plain === on secrets is a timing side-channel; both call sites here
// compare fixed-length values (hex digests, or the admin password against
// itself in length) so a simple constant-time loop is enough — no need to
// pull in Node's crypto.timingSafeEqual.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function isValidSessionCookie(cookieValue: string | undefined): Promise<boolean> {
  const expectedPassword = process.env.BLOG_ADMIN_PASSWORD;
  if (!expectedPassword || !cookieValue) return false;
  const expectedHash = await sha256Hex(expectedPassword);
  return constantTimeEqual(cookieValue, expectedHash);
}
