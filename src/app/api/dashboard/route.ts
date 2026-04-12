import { NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';
import { getDashboardStats } from '@/services/syncService';
import { getSetting } from '@/lib/db';

export async function GET() {
  try {
    const eposConfigured = !!(getSetting('epos_app_id') && getSetting('epos_app_secret'));
    const wooConfigured = !!(
      getSetting('woo_site_url') &&
      getSetting('woo_consumer_key') &&
      getSetting('woo_consumer_secret')
    );

    const [eposConnected, wooConnected] = await Promise.all([
      eposConfigured ? testEposConnection() : Promise.resolve(false),
      wooConfigured ? testWooConnection() : Promise.resolve(false),
    ]);

    const stats = await getDashboardStats();
    return NextResponse.json({
      ...stats,
      eposConnected,
      wooConnected,
      eposConfigured,
      wooConfigured,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
