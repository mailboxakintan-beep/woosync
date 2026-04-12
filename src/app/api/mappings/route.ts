import { NextRequest, NextResponse } from 'next/server';
import { getProductMappings, upsertProductMapping, deleteProductMapping, addLog } from '@/lib/db';

export async function GET() {
  const mappings = getProductMappings();
  return NextResponse.json({ mappings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { epos_id, woo_id, epos_name, woo_name } = body;

    if (!epos_id || !woo_id) {
      return NextResponse.json(
        { error: 'epos_id and woo_id are required' },
        { status: 400 }
      );
    }

    upsertProductMapping(
      String(epos_id),
      Number(woo_id),
      String(epos_name ?? ''),
      String(woo_name ?? '')
    );

    addLog(
      'manual-link',
      'success',
      `Manually linked ePOS "${epos_name ?? epos_id}" → WooCommerce "${woo_name ?? woo_id}"`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    deleteProductMapping(Number(id));
    addLog('manual-link', 'info', `Removed product mapping #${id}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
