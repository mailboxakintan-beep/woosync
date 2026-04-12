import { NextResponse } from 'next/server';
import { getRecentOrders } from '@/services/syncService';

export async function GET() {
  try {
    const orders = await getRecentOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
