import { NextResponse } from 'next/server';
import { getWooProductsWithVariants } from '@/services/wooService';

export async function GET() {
  try {
    const products = await getWooProductsWithVariants();
    const cleaned = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? '',
      regularPrice: p.regular_price ?? '',
      salePrice: p.sale_price ?? '',
      stockQuantity: p.stock_quantity ?? null,
      stockStatus: p.stock_status ?? '',
      type: p.type ?? 'simple',
      status: p.status ?? '',
      parentId: p.parent_id ?? null,
      parentName: p.parent_name ?? null,
    }));
    return NextResponse.json({ products: cleaned });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
