import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/shop', '/manifesto', '/contact', '/owners'];
const AUTH_PATHS   = ['/auth/login', '/auth/signup'];
const ADMIN_PREFIX = '/admin';
const AUTH_PREFIX  = ['/checkout', '/account', '/referral'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/shop/')) return true;
  if (pathname.startsWith('/api/payment/webhook')) return true;
  if (pathname.startsWith('/api/printify/webhook')) return true;
  return false;
}

function requiresAuth(pathname: string): boolean {
  return AUTH_PREFIX.some((p) => pathname.startsWith(p));
}

function requiresAdmin(pathname: string): boolean {
  return pathname.startsWith(ADMIN_PREFIX);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes, static assets, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;
  const isAdminClaim = request.cookies.get('is_admin')?.value === 'true';

  // Auth pages: redirect to home if already logged in
  if (AUTH_PATHS.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Protected routes: redirect to login if no session
  if (requiresAuth(pathname) && !session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: require session + admin cookie flag
  // Full JWT verification happens inside the admin layout server component
  if (requiresAdmin(pathname)) {
    if (!session) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminClaim) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
