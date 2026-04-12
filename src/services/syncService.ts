import { addLog, upsertProductMapping, getProductMappings, getDb } from '@/lib/db';
import { getEposProducts, getEposProductStocks } from './eposService';
import {
  getWooProducts,
  createWooProduct,
  updateWooProduct,
  batchUpdateWooProducts,
  getWooOrders,
} from './wooService';
import type { WooProduct } from './wooService';

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Sync products FROM ePOS Now TO WooCommerce.
 * - Creates new WooCommerce products for ePOS products with no mapping.
 * - Updates existing WooCommerce products (name, price) when a mapping exists.
 */
export async function syncProductsEposToWoo(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const [eposProducts, wooProducts] = await Promise.all([
      getEposProducts(),
      getWooProducts(),
    ]);

    const mappings = getProductMappings();
    const mappingByEposId = new Map(mappings.map((m) => [m.epos_id, m]));

    // Build SKU-based lookup for WooCommerce products
    const wooBySku = new Map<string, WooProduct>();
    for (const wp of wooProducts) {
      if (wp.sku) wooBySku.set(wp.sku, wp);
    }

    for (const ep of eposProducts) {
      if (ep.IsDeleted) {
        result.skipped++;
        continue;
      }

      const eposIdStr = String(ep.Id);
      const existing = mappingByEposId.get(eposIdStr);
      const eposSku = `epos-${ep.Id}`;

      try {
        if (existing) {
          // Update existing WooCommerce product
          await updateWooProduct(existing.woo_id, {
            name: ep.Name,
            regular_price: String(ep.SalePrice ?? 0),
            description: ep.Description ?? '',
          });
          upsertProductMapping(eposIdStr, existing.woo_id, ep.Name, ep.Name);
          result.updated++;
        } else {
          // Check if WooCommerce already has a product with this SKU
          const wooMatch = wooBySku.get(eposSku);
          if (wooMatch?.id) {
            upsertProductMapping(eposIdStr, wooMatch.id, ep.Name, wooMatch.name);
            result.skipped++;
          } else {
            // Create new WooCommerce product
            const created = await createWooProduct({
              name: ep.Name,
              type: 'simple',
              status: 'publish',
              regular_price: String(ep.SalePrice ?? 0),
              description: ep.Description ?? '',
              sku: eposSku,
              manage_stock: true,
            });
            upsertProductMapping(eposIdStr, created.id!, ep.Name, created.name);
            result.created++;
          }
        }
      } catch (err) {
        result.errors++;
        addLog('product-sync', 'error', `Failed to sync product "${ep.Name}"`, err);
      }
    }

    addLog(
      'product-sync',
      'success',
      `Products synced (ePOS → Woo): created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, errors=${result.errors}`
    );
  } catch (err) {
    addLog('product-sync', 'error', 'Product sync failed', err);
    throw err;
  }

  return result;
}

/**
 * Sync inventory/stock levels FROM ePOS Now TO WooCommerce.
 */
export async function syncInventoryEposToWoo(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const [stocks, mappings] = await Promise.all([
      getEposProductStocks(),
      Promise.resolve(getProductMappings()),
    ]);

    const mappingByEposId = new Map(mappings.map((m) => [m.epos_id, m]));

    // Aggregate stock per product across locations
    const stockByProductId = new Map<string, number>();
    for (const s of stocks) {
      const key = String(s.ProductId);
      const current = stockByProductId.get(key) ?? 0;
      stockByProductId.set(key, current + (s.CurrentStock ?? 0));
    }

    const updates: ({ id: number } & Partial<WooProduct>)[] = [];

    for (const [eposId, qty] of stockByProductId.entries()) {
      const mapping = mappingByEposId.get(eposId);
      if (!mapping) {
        result.skipped++;
        continue;
      }
      updates.push({ id: mapping.woo_id, stock_quantity: qty, manage_stock: true });
    }

    if (updates.length > 0) {
      // Batch in chunks of 50
      for (let i = 0; i < updates.length; i += 50) {
        await batchUpdateWooProducts(updates.slice(i, i + 50));
      }
      result.updated = updates.length;
    }

    addLog(
      'inventory-sync',
      'success',
      `Inventory synced (ePOS → Woo): updated=${result.updated}, skipped=${result.skipped}`
    );
  } catch (err) {
    addLog('inventory-sync', 'error', 'Inventory sync failed', err);
    throw err;
  }

  return result;
}

/**
 * Pull recent WooCommerce orders summary (for display in the dashboard).
 */
export async function getRecentOrders(page = 1) {
  try {
    const orders = await getWooOrders(page, 20);
    return orders;
  } catch (err) {
    addLog('orders', 'error', 'Failed to fetch WooCommerce orders', err);
    throw err;
  }
}

export interface DashboardStats {
  totalMappings: number;
  mappedProducts: number;
  recentSyncs: number;
  lastSync: string | null;
  eposConnected: boolean;
  wooConnected: boolean;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();
  const mappings = getProductMappings();
  const lastLog = db
    .prepare(`SELECT created_at FROM sync_logs WHERE status='success' ORDER BY created_at DESC LIMIT 1`)
    .get() as { created_at: string } | undefined;
  const recentSyncs = (
    db
      .prepare(`SELECT COUNT(*) as c FROM sync_logs WHERE created_at > datetime('now', '-24 hours')`)
      .get() as { c: number }
  ).c;

  return {
    totalMappings: mappings.length,
    mappedProducts: mappings.length,
    recentSyncs,
    lastSync: lastLog?.created_at ?? null,
    eposConnected: false, // will be set by caller
    wooConnected: false,
  };
}
