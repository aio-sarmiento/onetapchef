import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const VENDOR_ROUTES = ["/vendor"];
const AUTH_ROUTES = ["/auth/login", "/auth/register"];
const PROTECTED_ROUTES = ["/basket", "/orders", "/recipes/new", "/profile"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect authenticated users away from auth pages
  if (user && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const role = user.user_metadata?.role as string | undefined;
    const dest = role === "vendor" ? "/vendor/dashboard" : "/browse";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Redirect unauthenticated users away from protected routes
  const isProtected =
    PROTECTED_ROUTES.some((r) => pathname.startsWith(r)) ||
    VENDOR_ROUTES.some((r) => pathname.startsWith(r));

  if (!user && isProtected) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect non-vendors away from vendor routes
  if (user && VENDOR_ROUTES.some((r) => pathname.startsWith(r))) {
    const role = user.user_metadata?.role as string | undefined;
    if (role !== "vendor" && role !== "admin") {
      return NextResponse.redirect(new URL("/browse", request.url));
    }
  }

  // Redirect vendors away from student-only routes
  if (user && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const role = user.user_metadata?.role as string | undefined;
    if (role === "vendor") {
      return NextResponse.redirect(new URL("/vendor/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
