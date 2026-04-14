import { NextResponse } from 'next/server';
import { getEposProducts } from '@/services/eposService';

export async function GET() {
  try {
    const products = await getEposProducts();
    // Filter out deleted products and return a clean shape
    const cleaned = products
      .filter((p) => !p.IsDeleted)
      .map((p) => ({
        id: p.Id,
        name: p.Name,
        description: p.Description ?? '',
        salePrice: p.SalePrice,
        costPrice: p.CostPrice ?? 0,
        sku: p.Sku ?? '',
        barcode: p.Barcode ?? '',
        orderCode: p.OrderCode ?? '',
        articleCode: p.ArticleCode ?? '',
        categoryId: p.CategoryId ?? null,
      }));
    return NextResponse.json({ products: cleaned });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
