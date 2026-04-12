import { NextRequest, NextResponse } from 'next/server';
import { getLogs } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? 100);
  const logs = getLogs(Math.min(limit, 500));
  return NextResponse.json({ logs });
}
