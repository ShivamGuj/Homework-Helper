import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)',
  ],
};

export default function middleware(request: NextRequest) {
  // Assume the user is authenticated for paths that don't require auth checks
  // This helps to avoid headers usage during static generation
  
  // For paths requiring authentication, the client components will handle redirection
  return NextResponse.next();
}
