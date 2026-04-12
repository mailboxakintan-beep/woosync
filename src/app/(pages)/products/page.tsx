'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, PackageSearch, Link2 } from 'lucide-react';

interface Mapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export default function ProductsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mappings');
      const data = await res.json();
      setMappings(data.mappings ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleSyncProducts = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync/products', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.result);
        fetchMappings();
      } else {
        setError(data.error ?? 'Sync failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync/inventory', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.result);
        fetchMappings();
      } else {
        setError(data.error ?? 'Inventory sync failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 mt-1">
            Sync products from ePOS Now to your WooCommerce store.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncInventory}
            disabled={syncing}
            className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Inventory
          </button>
          <button
            onClick={handleSyncProducts}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Products
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          ✓ Sync complete — Created: <strong>{syncResult.created}</strong>, Updated:{' '}
          <strong>{syncResult.updated}</strong>, Skipped: <strong>{syncResult.skipped}</strong>,
          Errors: <strong>{syncResult.errors}</strong>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ✗ {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Product Mappings</h2>
          <span className="text-slate-400 text-sm">{mappings.length} products</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <PackageSearch className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No product mappings yet.</p>
            <p className="text-xs mt-1">Run &quot;Sync Products&quot; to import from ePOS Now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Product Name</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">ePOS Now ID</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">WooCommerce ID</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Last Synced</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-medium text-slate-700">{m.epos_name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">{m.epos_id}</td>
                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">{m.woo_id}</td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {m.last_synced ? new Date(m.last_synced).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
