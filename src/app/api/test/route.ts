import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    nextauth_secret: process.env.NEXTAUTH_SECRET,
    mongodb_uri: process.env.MONGODB_URI,
    nextauth_url: process.env.NEXTAUTH_URL,
  });
}
