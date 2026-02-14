import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authStatus = request.cookies.get('origo_auth');
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (!authStatus || authStatus.value !== 'true') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
