'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShoppingCart } from 'lucide-react';

interface OrderLine {
  product_id?: number;
  name?: string;
  quantity?: number;
  total?: string;
}

interface Order {
  id?: number;
  status?: string;
  total?: string;
  date_created?: string;
  billing?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items?: OrderLine[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
  refunded: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-600',
  'on-hold': 'bg-orange-100 text-orange-700',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sync/orders');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOrders(data.orders ?? []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-slate-500 mt-1">Recent orders from your WooCommerce store.</p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ✗ {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Recent Orders</h2>
          <span className="text-slate-400 text-sm">{orders.length} orders</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No orders found.</p>
            <p className="text-xs mt-1">Make sure your WooCommerce connection is configured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Order #</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Customer</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Total</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Items</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">#{o.id}</td>
                    <td className="px-6 py-3">
                      {o.billing ? (
                        <div>
                          <p className="font-medium text-slate-700">
                            {o.billing.first_name} {o.billing.last_name}
                          </p>
                          <p className="text-slate-400 text-xs">{o.billing.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[o.status ?? ''] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {o.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-700">
                      £{parseFloat(o.total ?? '0').toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {o.line_items?.length ?? 0} item{(o.line_items?.length ?? 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {o.date_created ? new Date(o.date_created).toLocaleDateString() : '—'}
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
