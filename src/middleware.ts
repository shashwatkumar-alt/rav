import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'rav-auth-token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  // Only login and logout are public — login needs to work before auth,
  // logout just clears the cookie so it's safe to be public.
  const publicPaths = ['/api/auth/login', '/api/auth/logout'];
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // All other matched routes require a valid JWT
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // If JWT_SECRET is not configured, reject all tokens — never fall back to a known secret
      console.error('JWT_SECRET environment variable is not set');
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    const secret = new TextEncoder().encode(jwtSecret);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
