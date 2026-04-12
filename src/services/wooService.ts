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
