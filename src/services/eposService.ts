import axios, { AxiosInstance } from 'axios';
import { getSetting } from '@/lib/db';

export interface EposProduct {
  Id: number;
  Name: string;
  Description?: string;
  SalePrice: number;
  CostPrice?: number;
  Sku?: string;
  Barcode?: string;
  OrderCode?: string;
  ArticleCode?: string;
  CategoryId?: number;
  TaxRateId?: number;
  IsDeleted?: boolean;
}

export interface EposProductStock {
  Id: number;
  ProductId: number;
  LocationId: number;
  CurrentStock: number;
  MinStock?: number;
  MaxStock?: number;
}

export interface EposTransaction {
  Id: number;
  TotalAmount: number;
  CreatedAt: string;
  Status?: string;
  TransactionLines?: EposTransactionLine[];
}

export interface EposTransactionLine {
  ProductId: number;
  ProductName: string;
  Quantity: number;
  UnitPrice: number;
}

function buildClient(): AxiosInstance {
  const appId = getSetting('epos_app_id');
  const appSecret = getSetting('epos_app_secret');

  if (!appId || !appSecret) {
    throw new Error('ePOS Now credentials not configured. Please visit Settings.');
  }

  const token = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  return axios.create({
    baseURL: 'https://api.eposnowhq.com',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

async function getAllPages<T>(path: string): Promise<T[]> {
  const client = buildClient();
  const results: T[] = [];
  let page = 1;

  while (true) {
    const res = await client.get<T[]>(`${path}?page=${page}`);
    const data = res.data;
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 200) break; // ePOS returns up to 200 per page
    page++;
  }

  return results;
}

export async function getEposProducts(): Promise<EposProduct[]> {
  return getAllPages<EposProduct>('/api/V4/Product');
}

export async function getEposProduct(id: number): Promise<EposProduct> {
  const client = buildClient();
  const res = await client.get<EposProduct>(`/api/V4/Product/${id}`);
  return res.data;
}

export async function createEposProduct(product: Partial<EposProduct>): Promise<EposProduct> {
  const client = buildClient();
  const res = await client.post<EposProduct>('/api/V4/Product', product);
  return res.data;
}

export async function updateEposProduct(
  id: number,
  product: Partial<EposProduct>
): Promise<EposProduct> {
  const client = buildClient();
  const res = await client.put<EposProduct>(`/api/V4/Product/${id}`, product);
  return res.data;
}

export async function getEposProductStocks(): Promise<EposProductStock[]> {
  return getAllPages<EposProductStock>('/api/V4/ProductStock');
}

export async function updateEposProductStock(
  id: number,
  stock: Partial<EposProductStock>
): Promise<EposProductStock> {
  const client = buildClient();
  const res = await client.put<EposProductStock>(`/api/V4/ProductStock/${id}`, stock);
  return res.data;
}

export async function getEposTransactions(page = 1): Promise<EposTransaction[]> {
  const client = buildClient();
  const res = await client.get<EposTransaction[]>(`/api/V4/Transaction?page=${page}`);
  return res.data;
}

export async function testEposConnection(): Promise<boolean> {
  try {
    const client = buildClient();
    await client.get('/api/V4/Product?page=1');
    return true;
  } catch {
    return false;
  }
}
