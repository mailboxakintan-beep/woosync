import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { getSetting } from '@/lib/db';

export interface WooProduct {
  id?: number;
  name: string;
  type?: string;
  status?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  categories?: { id: number; name?: string }[];
  meta_data?: { key: string; value: string }[];
  attributes?: { name: string; option: string }[];
  parent_id?: number;
  parent_name?: string;
}

export interface WooVariation {
  id?: number;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  attributes?: { name: string; option: string }[];
}

export interface WooOrder {
  id?: number;
  status?: string;
  currency?: string;
  total?: string;
  date_created?: string;
  billing?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items?: WooOrderLine[];
}

export interface WooOrderLine {
  product_id?: number;
  name?: string;
  quantity?: number;
  price?: string;
  total?: string;
}

function buildClient() {
  const siteUrl = getSetting('woo_site_url');
  const consumerKey = getSetting('woo_consumer_key');
  const consumerSecret = getSetting('woo_consumer_secret');

  if (!siteUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce credentials not configured. Please visit Settings.');
  }

  return new WooCommerceRestApi({
    url: siteUrl,
    consumerKey,
    consumerSecret,
    version: 'wc/v3',
    axiosConfig: { timeout: 15000 },
  });
}

async function getAllPages<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const client = buildClient();
  const results: T[] = [];
  let page = 1;

  while (true) {
    const res = await client.get(endpoint, { ...params, per_page: 100, page });
    const data = res.data as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return results;
}

export async function getWooProducts(): Promise<WooProduct[]> {
  return getAllPages<WooProduct>('products');
}

export async function getWooProductVariations(productId: number): Promise<WooVariation[]> {
  return getAllPages<WooVariation>(`products/${productId}/variations`);
}

/** Fetches all products including individual variations for variable products. */
export async function getWooProductsWithVariants(): Promise<WooProduct[]> {
  const products = await getWooProducts();
  const result: WooProduct[] = [];

  const variableProducts = products.filter((p) => p.type === 'variable');
  const nonVariableProducts = products.filter((p) => p.type !== 'variable');

  // Add all non-variable products as-is
  result.push(...nonVariableProducts);

  // Fetch variations for each variable product (in parallel, batches of 5)
  for (let i = 0; i < variableProducts.length; i += 5) {
    const batch = variableProducts.slice(i, i + 5);
    const variationBatches = await Promise.all(
      batch.map(async (parent) => {
        try {
          const variations = await getWooProductVariations(parent.id!);
          return variations.map((v) => {
            const attrLabel = v.attributes?.map((a) => a.option).join(' / ') || '';
            return {
              id: v.id,
              name: attrLabel ? `${parent.name} — ${attrLabel}` : parent.name,
              type: 'variation' as const,
              status: parent.status,
              sku: v.sku,
              regular_price: v.regular_price,
              sale_price: v.sale_price,
              manage_stock: v.manage_stock,
              stock_quantity: v.stock_quantity,
              stock_status: v.stock_status,
              attributes: v.attributes,
              parent_id: parent.id,
              parent_name: parent.name,
            } satisfies WooProduct;
          });
        } catch {
          // If fetching variations fails, include the parent product itself
          return [parent];
        }
      })
    );
    result.push(...variationBatches.flat());
  }

  return result;
}

export async function getWooProduct(id: number): Promise<WooProduct> {
  const client = buildClient();
  const res = await client.get(`products/${id}`, {});
  return res.data as WooProduct;
}

export async function createWooProduct(product: WooProduct): Promise<WooProduct> {
  const client = buildClient();
  const res = await client.post('products', product);
  return res.data as WooProduct;
}

export async function updateWooProduct(id: number, product: Partial<WooProduct>): Promise<WooProduct> {
  const client = buildClient();
  const res = await client.put(`products/${id}`, product);
  return res.data as WooProduct;
}

export async function batchUpdateWooProducts(
  updates: Array<{ id: number } & Partial<WooProduct>>
): Promise<void> {
  const client = buildClient();
  await client.post('products/batch', { update: updates });
}

export async function getWooOrders(page = 1, perPage = 50): Promise<WooOrder[]> {
  const client = buildClient();
  const res = await client.get('orders', { per_page: perPage, page });
  return res.data as WooOrder[];
}

export async function testWooConnection(): Promise<boolean> {
  try {
    const client = buildClient();
    await client.get('products', { per_page: 1, page: 1 });
    return true;
  } catch {
    return false;
  }
}
