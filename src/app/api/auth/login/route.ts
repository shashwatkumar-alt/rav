import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    // Check if credentials are set in the server environment before validation
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminUser || !adminPass) {
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_USERNAME or ADMIN_PASSWORD is not set in the production environment.' },
        { status: 500 }
      );
    }

    const isValid = await validateCredentials(username, password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    let token: string;
    try {
      token = await signToken();
    } catch (err) {
      console.error('Failed to sign token:', err);
      const details = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Server configuration error: Failed to sign token. Details: ${details}` },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

