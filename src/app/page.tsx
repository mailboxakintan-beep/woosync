'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  PackageSearch,
  ShoppingCart,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface DashboardData {
  eposConnected: boolean;
  wooConnected: boolean;
  eposConfigured: boolean;
  wooConfigured: boolean;
  mappedProducts: number;
  recentSyncs: number;
  lastSync: string | null;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch {
      setData({
        eposConnected: false,
        wooConnected: false,
        eposConfigured: false,
        wooConfigured: false,
        mappedProducts: 0,
        recentSyncs: 0,
        lastSync: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const [prod, inv] = await Promise.all([
        fetch('/api/sync/products', { method: 'POST' }).then((r) => r.json()),
        fetch('/api/sync/inventory', { method: 'POST' }).then((r) => r.json()),
      ]);
      if (prod.success && inv.success) {
        setSyncMsg(
          `✓ Synced! Products: created ${prod.result.created}, updated ${prod.result.updated}. Inventory: updated ${inv.result.updated}.`
        );
      } else {
        setSyncMsg('⚠ Partial sync. Check logs for details.');
      }
      fetchDashboard();
    } catch {
      setSyncMsg('✗ Sync failed. Check settings and logs.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const bothConnected = data?.eposConnected && data?.wooConnected;
  const neitherConfigured = !data?.eposConfigured && !data?.wooConfigured;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Sync your ePOS Now POS with your WooCommerce store at{' '}
          <a
            href="https://sterlinglams.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            sterlinglams.com
          </a>
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">Connection Status</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge ok={!!data?.eposConnected} label="ePOS Now" />
          <StatusBadge ok={!!data?.wooConnected} label="WooCommerce" />
        </div>
        {neitherConfigured && (
          <div className="mt-4 flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              No API credentials configured yet.{' '}
              <Link href="/settings" className="font-medium underline">
                Go to Settings
              </Link>{' '}
              to connect your ePOS Now and WooCommerce accounts.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={PackageSearch}
          label="Synced Products"
          value={data?.mappedProducts ?? 0}
          sub="ePOS ↔ WooCommerce mappings"
          color="bg-indigo-500"
        />
        <StatCard
          icon={RefreshCw}
          label="Syncs (24h)"
          value={data?.recentSyncs ?? 0}
          sub="in the last 24 hours"
          color="bg-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="Last Sync"
          value={data?.lastSync ? new Date(data.lastSync).toLocaleTimeString() : '—'}
          sub={
            data?.lastSync ? new Date(data.lastSync).toLocaleDateString() : 'Never synced'
          }
          color="bg-violet-500"
        />
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h2 className="font-semibold text-slate-700 mb-2">Manual Sync</h2>
        <p className="text-slate-500 text-sm mb-4">
          Trigger an immediate sync of all products and inventory from ePOS Now to WooCommerce.
        </p>
        <button
          onClick={handleSyncAll}
          disabled={syncing || !bothConnected}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        {!bothConnected && (
          <p className="text-slate-400 text-xs mt-2">
            Both connections must be active to sync.{' '}
            <Link href="/settings" className="text-indigo-500 underline">
              Configure settings
            </Link>
          </p>
        )}
        {syncMsg && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            {syncMsg}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: '/products',
            label: 'Manage Products',
            desc: 'View and sync products',
            icon: PackageSearch,
          },
          {
            href: '/orders',
            label: 'View Orders',
            desc: 'Browse WooCommerce orders',
            icon: ShoppingCart,
          },
          {
            href: '/logs',
            label: 'Sync Logs',
            desc: 'Audit trail of all syncs',
            icon: Clock,
          },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="font-medium text-slate-700 text-sm">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
