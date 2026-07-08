import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from './lib/jwt-secret';

const COOKIE_NAME = 'rav-auth-token';

export async function proxy(request: NextRequest) {
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
    const secret = getJwtSecret();
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch (err) {
    console.error('Auth verification error in proxy:', err);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
