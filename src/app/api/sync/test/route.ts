import { NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';

export async function GET() {
  const [epos, woo] = await Promise.all([
    testEposConnection(),
    testWooConnection(),
  ]);
  return NextResponse.json({ epos, woo });
}
