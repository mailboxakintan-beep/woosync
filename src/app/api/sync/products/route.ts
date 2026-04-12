import { NextResponse } from 'next/server';
import { syncProductsEposToWoo } from '@/services/syncService';

export async function POST() {
  try {
    const result = await syncProductsEposToWoo();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
