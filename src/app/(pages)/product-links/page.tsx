'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Link2,
  Unlink,
  CheckCircle2,
  PackageSearch,
  Save,
  Wand2,
  X,
  AlertTriangle,
} from 'lucide-react';

/* ---------- types ---------- */

interface EposProduct {
  id: number;
  name: string;
  description: string;
  salePrice: number;
  costPrice: number;
  barcode: string;
  categoryId: number | null;
}

interface WooProduct {
  id: number;
  name: string;
  sku: string;
  regularPrice: string;
  salePrice: string;
  stockQuantity: number | null;
  stockStatus: string;
  type: string;
  status: string;
}

interface Mapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

type LinkStatus = 'linked' | 'to-save' | 'to-unlink' | 'not-linked';

interface PendingLink {
  wooId: number;
  eposId: number;
  eposName: string;
  wooName: string;
  status: LinkStatus;
}

/* ---------- helpers ---------- */

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: LinkStatus }) {
  switch (status) {
    case 'linked':
      return <Badge color="bg-green-100 text-green-700">Linked</Badge>;
    case 'to-save':
      return <Badge color="bg-cyan-100 text-cyan-700">To Save</Badge>;
    case 'to-unlink':
      return <Badge color="bg-yellow-100 text-yellow-700">To Unlink</Badge>;
    default:
      return <Badge color="bg-slate-100 text-slate-500">Not Linked</Badge>;
  }
}

/* ---------- component ---------- */

export default function ProductLinksPage() {
  // data
  const [eposProducts, setEposProducts] = useState<EposProduct[]>([]);
  const [wooProducts, setWooProducts] = useState<WooProduct[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  // pending changes (unsaved links/unlinks) — keyed by wooId
  const [pendingLinks, setPendingLinks] = useState<Record<number, PendingLink>>({});
  const [pendingUnlinks, setPendingUnlinks] = useState<Record<number, number>>({}); // wooId → mappingId

  // loading / errors
  const [loadingEpos, setLoadingEpos] = useState(false);
  const [loadingWoo, setLoadingWoo] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // UI state
  const [searchEpos, setSearchEpos] = useState('');
  const [searchWoo, setSearchWoo] = useState('');
  const [selectedEpos, setSelectedEpos] = useState<EposProduct | null>(null);
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');

  // derived lookups
  const mappedEposIds = useMemo(() => {
    const set = new Set(mappings.map((m) => m.epos_id));
    Object.values(pendingLinks).forEach((p) => set.add(String(p.eposId)));
    return set;
  }, [mappings, pendingLinks]);

  const wooToMapping = useMemo(() => {
    const map = new Map<number, Mapping>();
    mappings.forEach((m) => map.set(m.woo_id, m));
    return map;
  }, [mappings]);

  const eposToWoo = useMemo(() => {
    const map = new Map<string, number>();
    mappings.forEach((m) => map.set(m.epos_id, m.woo_id));
    Object.values(pendingLinks).forEach((p) => map.set(String(p.eposId), p.wooId));
    return map;
  }, [mappings, pendingLinks]);

  const hasUnsavedChanges = Object.keys(pendingLinks).length > 0 || Object.keys(pendingUnlinks).length > 0;

  /* ---------- fetchers ---------- */

  const fetchEpos = async () => {
    setLoadingEpos(true);
    try {
      const res = await fetch('/api/epos/products');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEposProducts(data.products ?? []);
    } catch (err) {
      setError(`Failed to load ePOS products: ${err}`);
    } finally {
      setLoadingEpos(false);
    }
  };

  const fetchWoo = async () => {
    setLoadingWoo(true);
    try {
      const res = await fetch('/api/woo/products');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWooProducts(data.products ?? []);
    } catch (err) {
      setError(`Failed to load WooCommerce products: ${err}`);
    } finally {
      setLoadingWoo(false);
    }
  };

  const fetchMappings = async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch('/api/mappings');
      const data = await res.json();
      setMappings(data.mappings ?? []);
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchEpos();
    fetchWoo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  /* ---------- link status for a WooCommerce product ---------- */

  const getWooLinkStatus = useCallback(
    (wooId: number): { status: LinkStatus; eposId?: number; eposName?: string; mappingId?: number } => {
      // Check pending unlinks first
      if (pendingUnlinks[wooId]) {
        return { status: 'to-unlink', mappingId: pendingUnlinks[wooId] };
      }
      // Check pending links
      if (pendingLinks[wooId]) {
        return { status: 'to-save', eposId: pendingLinks[wooId].eposId, eposName: pendingLinks[wooId].eposName };
      }
      // Check saved mappings
      const mapping = wooToMapping.get(wooId);
      if (mapping) {
        return { status: 'linked', eposId: Number(mapping.epos_id), eposName: mapping.epos_name ?? undefined, mappingId: mapping.id };
      }
      return { status: 'not-linked' };
    },
    [pendingLinks, pendingUnlinks, wooToMapping]
  );

  const getEposLinkStatus = useCallback(
    (eposId: number): LinkStatus => {
      if (mappedEposIds.has(String(eposId))) return 'linked';
      return 'not-linked';
    },
    [mappedEposIds]
  );

  /* ---------- actions ---------- */

  const handleLinkWoo = (wooProduct: WooProduct) => {
    if (!selectedEpos) return;
    // Add to pending
    setPendingLinks((prev) => ({
      ...prev,
      [wooProduct.id]: {
        wooId: wooProduct.id,
        eposId: selectedEpos.id,
        eposName: selectedEpos.name,
        wooName: wooProduct.name,
        status: 'to-save',
      },
    }));
    // Remove from pending unlinks if it was there
    setPendingUnlinks((prev) => {
      const next = { ...prev };
      delete next[wooProduct.id];
      return next;
    });
    setSelectedEpos(null);
    setSuccessMsg('');
  };

  const handleUnlinkWoo = (wooId: number) => {
    const mapping = wooToMapping.get(wooId);
    if (mapping) {
      // Mark existing mapping for deletion
      setPendingUnlinks((prev) => ({ ...prev, [wooId]: mapping.id }));
    }
    // Also remove any pending link for this woo product
    setPendingLinks((prev) => {
      const next = { ...prev };
      delete next[wooId];
      return next;
    });
  };

  const handleCancelPending = (wooId: number) => {
    setPendingLinks((prev) => {
      const next = { ...prev };
      delete next[wooId];
      return next;
    });
    setPendingUnlinks((prev) => {
      const next = { ...prev };
      delete next[wooId];
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      // Save new links
      for (const link of Object.values(pendingLinks)) {
        const res = await fetch('/api/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            epos_id: String(link.eposId),
            woo_id: link.wooId,
            epos_name: link.eposName,
            woo_name: link.wooName,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to save link for WooCommerce #${link.wooId}`);
        }
      }

      // Delete unlinked mappings
      for (const [, mappingId] of Object.entries(pendingUnlinks)) {
        const res = await fetch(`/api/mappings?id=${mappingId}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to remove mapping #${mappingId}`);
        }
      }

      const savedCount = Object.keys(pendingLinks).length;
      const removedCount = Object.keys(pendingUnlinks).length;

      setPendingLinks({});
      setPendingUnlinks({});
      await fetchMappings();

      const parts: string[] = [];
      if (savedCount) parts.push(`${savedCount} linked`);
      if (removedCount) parts.push(`${removedCount} unlinked`);
      setSuccessMsg(`✓ Saved successfully — ${parts.join(', ')}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- auto-match ---------- */

  const handleAutoMatch = (matchBy: 'name' | 'sku') => {
    if (eposProducts.length === 0 || wooProducts.length === 0) return;
    setAutoMatching(true);
    setError('');
    setSuccessMsg('');

    const existingWooLinked = new Set<number>();
    const existingEposLinked = new Set<string>();
    mappings.forEach((m) => {
      existingWooLinked.add(m.woo_id);
      existingEposLinked.add(m.epos_id);
    });
    // Also exclude already-pending links
    Object.values(pendingLinks).forEach((p) => {
      existingWooLinked.add(p.wooId);
      existingEposLinked.add(String(p.eposId));
    });

    const newLinks: Record<number, PendingLink> = {};
    let matchCount = 0;

    if (matchBy === 'name') {
      // Build ePOS name lookup (lowercase -> product) — skip already linked
      const eposNameMap = new Map<string, EposProduct>();
      eposProducts.forEach((ep) => {
        if (!existingEposLinked.has(String(ep.id))) {
          eposNameMap.set(ep.name.toLowerCase().trim(), ep);
        }
      });

      wooProducts.forEach((wp) => {
        if (existingWooLinked.has(wp.id)) return;
        const match = eposNameMap.get(wp.name.toLowerCase().trim());
        if (match) {
          newLinks[wp.id] = {
            wooId: wp.id,
            eposId: match.id,
            eposName: match.name,
            wooName: wp.name,
            status: 'to-save',
          };
          existingWooLinked.add(wp.id);
          existingEposLinked.add(String(match.id));
          matchCount++;
        }
      });
    } else {
      // Match by WooCommerce SKU against ePOS barcode or "epos-{id}"
      const eposBarcodeMap = new Map<string, EposProduct>();
      const eposIdMap = new Map<string, EposProduct>();
      eposProducts.forEach((ep) => {
        if (existingEposLinked.has(String(ep.id))) return;
        if (ep.barcode) eposBarcodeMap.set(ep.barcode.toLowerCase().trim(), ep);
        eposIdMap.set(`epos-${ep.id}`, ep);
      });

      wooProducts.forEach((wp) => {
        if (existingWooLinked.has(wp.id) || !wp.sku) return;
        const skuLower = wp.sku.toLowerCase().trim();
        const match = eposBarcodeMap.get(skuLower) ?? eposIdMap.get(skuLower);
        if (match) {
          newLinks[wp.id] = {
            wooId: wp.id,
            eposId: match.id,
            eposName: match.name,
            wooName: wp.name,
            status: 'to-save',
          };
          existingWooLinked.add(wp.id);
          existingEposLinked.add(String(match.id));
          matchCount++;
        }
      });
    }

    setPendingLinks((prev) => ({ ...prev, ...newLinks }));
    setAutoMatching(false);

    if (matchCount > 0) {
      setSuccessMsg(`Auto-matched ${matchCount} product${matchCount > 1 ? 's' : ''} by ${matchBy}. Click "Save All" to confirm.`);
    } else {
      setSuccessMsg(`No new matches found by ${matchBy}.`);
    }
  };

  /* ---------- filtered lists ---------- */

  const filteredEpos = useMemo(() => {
    const q = searchEpos.toLowerCase();
    return eposProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [eposProducts, searchEpos]);

  const filteredWoo = useMemo(() => {
    const q = searchWoo.toLowerCase();
    return wooProducts
      .filter((p) => {
        if (!p.name.toLowerCase().includes(q) && !String(p.id).includes(q) && !(p.sku && p.sku.toLowerCase().includes(q))) {
          return false;
        }
        if (filterLinked === 'linked') {
          const { status } = getWooLinkStatus(p.id);
          return status === 'linked' || status === 'to-save';
        }
        if (filterLinked === 'unlinked') {
          const { status } = getWooLinkStatus(p.id);
          return status === 'not-linked' || status === 'to-unlink';
        }
        return true;
      });
  }, [wooProducts, searchWoo, filterLinked, getWooLinkStatus]);

  /* ---------- render ---------- */

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Product Links</h1>
          <p className="text-slate-500 mt-1">
            Link ePOS Now products to WooCommerce products. Select an ePOS product on the left, then
            click &quot;Link&quot; on a WooCommerce product on the right.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-match dropdown */}
          <div className="relative group">
            <button
              disabled={autoMatching || eposProducts.length === 0 || wooProducts.length === 0}
              className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              <Wand2 className={`w-4 h-4 ${autoMatching ? 'animate-spin' : ''}`} />
              Auto-Match
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-48 hidden group-hover:block z-20">
              <button
                onClick={() => handleAutoMatch('name')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Match by product name
              </button>
              <button
                onClick={() => handleAutoMatch('sku')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Match by SKU / barcode
              </button>
            </div>
          </div>

          {/* Save all */}
          <button
            onClick={handleSaveAll}
            disabled={!hasUnsavedChanges || saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : `Save All${hasUnsavedChanges ? ` (${Object.keys(pendingLinks).length + Object.keys(pendingUnlinks).length})` : ''}`}
          </button>
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasUnsavedChanges && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You have {Object.keys(pendingLinks).length + Object.keys(pendingUnlinks).length} unsaved change(s). Click &quot;Save All&quot; to apply.
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer" onClick={() => setError('')} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-green-400 hover:text-green-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Side-by-side tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ──── ePOS Now Products (Left) ──── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/50">
            <h2 className="font-semibold text-blue-700 text-sm">
              ePOS Now Products
              <span className="ml-2 text-blue-400 font-normal">({eposProducts.length})</span>
            </h2>
          </div>

          {/* Search + refresh */}
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ID, barcode…"
                value={searchEpos}
                onChange={(e) => setSearchEpos(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={fetchEpos}
              disabled={loadingEpos}
              className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-500 transition-colors"
              title="Refresh ePOS products"
            >
              <RefreshCw className={`w-4 h-4 ${loadingEpos ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          {loadingEpos ? (
            <div className="flex items-center justify-center py-16 flex-1">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          ) : filteredEpos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 flex-1">
              <PackageSearch className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">
                {eposProducts.length === 0 ? 'No ePOS products loaded.' : 'No matches.'}
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs">Product Name</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-16">ID</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-20">Price</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-500 text-xs w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEpos.map((p) => {
                    const linkStatus = getEposLinkStatus(p.id);
                    const isSelected = selectedEpos?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => {
                          if (isSelected) setSelectedEpos(null);
                          else { setSelectedEpos(p); setSuccessMsg(''); }
                        }}
                        className={`border-b border-slate-50 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-100 ring-1 ring-inset ring-blue-300'
                            : 'hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-700 max-w-[200px] truncate" title={p.name}>
                          {p.name}
                          {p.barcode && <span className="block text-xs text-slate-400 truncate">{p.barcode}</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{p.id}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs">£{(p.salePrice ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={linkStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ──── WooCommerce Products (Right) ──── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-purple-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-purple-700 text-sm">
              WooCommerce Products
              <span className="ml-2 text-purple-400 font-normal">({wooProducts.length})</span>
            </h2>
            {selectedEpos && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Linking: {selectedEpos.name} (#{selectedEpos.id})
                <button onClick={() => setSelectedEpos(null)} className="ml-1 hover:text-blue-900">
                  <X className="w-3 h-3 inline" />
                </button>
              </span>
            )}
          </div>

          {/* Search + filters + refresh */}
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ID, SKU…"
                value={searchWoo}
                onChange={(e) => setSearchWoo(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <select
              value={filterLinked}
              onChange={(e) => setFilterLinked(e.target.value as 'all' | 'linked' | 'unlinked')}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
            <button
              onClick={fetchWoo}
              disabled={loadingWoo}
              className="p-1.5 rounded-lg border border-slate-200 hover:border-purple-300 text-slate-500 hover:text-purple-500 transition-colors"
              title="Refresh WooCommerce products"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWoo ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          {loadingWoo ? (
            <div className="flex items-center justify-center py-16 flex-1">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            </div>
          ) : filteredWoo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 flex-1">
              <PackageSearch className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">
                {wooProducts.length === 0 ? 'No WooCommerce products loaded.' : 'No matches.'}
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs">Product Name</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-16">ID</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-20">Price</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-28">Linked ePOS</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-500 text-xs w-20">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500 text-xs w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWoo.map((p) => {
                    const linkInfo = getWooLinkStatus(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-50 transition-colors ${
                          linkInfo.status === 'to-save'
                            ? 'bg-cyan-50/50'
                            : linkInfo.status === 'to-unlink'
                              ? 'bg-yellow-50/50'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-700 max-w-[180px] truncate" title={p.name}>
                          {p.name}
                          {p.sku && <span className="block text-xs text-slate-400 truncate">SKU: {p.sku}</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{p.id}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs">£{parseFloat(p.regularPrice || '0').toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px]" title={linkInfo.eposName ?? ''}>
                          {linkInfo.eposName ? (
                            <span>
                              {linkInfo.eposName}
                              <span className="text-slate-300 block font-mono">#{linkInfo.eposId}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={linkInfo.status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {linkInfo.status === 'to-save' || linkInfo.status === 'to-unlink' ? (
                            <button
                              onClick={() => handleCancelPending(p.id)}
                              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                            >
                              Undo
                            </button>
                          ) : linkInfo.status === 'linked' ? (
                            <button
                              onClick={() => handleUnlinkWoo(p.id)}
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              <Unlink className="w-3 h-3" />
                              Unlink
                            </button>
                          ) : selectedEpos ? (
                            <button
                              onClick={() => handleLinkWoo(p)}
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Link2 className="w-3 h-3" />
                              Link
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">Select ePOS ←</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ──── Current Links Summary ──── */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">
            Saved Product Links
            <span className="ml-2 text-slate-400 font-normal text-sm">({mappings.length})</span>
          </h2>
          <button
            onClick={fetchMappings}
            disabled={loadingMappings}
            className="p-1.5 rounded border border-slate-200 hover:border-indigo-300 text-slate-400 hover:text-indigo-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMappings ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Link2 className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm">No products linked yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-2.5 text-left font-medium text-slate-500 text-xs">ePOS Now Product</th>
                  <th className="px-6 py-2.5 text-center font-medium text-slate-500 text-xs w-10" />
                  <th className="px-6 py-2.5 text-left font-medium text-slate-500 text-xs">WooCommerce Product</th>
                  <th className="px-6 py-2.5 text-left font-medium text-slate-500 text-xs">Last Synced</th>
                  <th className="px-6 py-2.5 text-right font-medium text-slate-500 text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const isPendingUnlink = pendingUnlinks[m.woo_id] === m.id;
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-50 transition-colors ${
                        isPendingUnlink ? 'bg-yellow-50/50 opacity-60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-6 py-2.5">
                        <p className="font-medium text-slate-700">{m.epos_name || '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">ID: {m.epos_id}</p>
                      </td>
                      <td className="px-6 py-2.5 text-center">
                        <Link2 className="w-3.5 h-3.5 text-indigo-400 inline-block" />
                      </td>
                      <td className="px-6 py-2.5">
                        <p className="font-medium text-slate-700">{m.woo_name || '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">ID: {m.woo_id}</p>
                      </td>
                      <td className="px-6 py-2.5 text-slate-400 text-xs">
                        {m.last_synced ? new Date(m.last_synced).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-2.5 text-right">
                        {isPendingUnlink ? (
                          <button
                            onClick={() => handleCancelPending(m.woo_id)}
                            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnlinkWoo(m.woo_id)}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            <Unlink className="w-3 h-3" />
                            Unlink
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
