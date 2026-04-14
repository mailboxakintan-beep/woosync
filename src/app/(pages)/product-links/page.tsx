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
  ChevronDown,
} from 'lucide-react';

/* ---------- types ---------- */

interface EposProduct {
  id: number;
  name: string;
  description: string;
  salePrice: number;
  costPrice: number;
  sku: string;
  barcode: string;
  orderCode: string;
  articleCode: string;
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
  parentId: number | null;
  parentName: string | null;
}

interface Mapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

type LinkStatus = 'linked' | 'to-save' | 'to-unlink' | 'not-linked' | 'linked-not-found';

interface PendingLink {
  wooId: number;
  eposId: number;
  eposName: string;
  wooName: string;
  status: LinkStatus;
}

/* ---------- auto-match criteria (mirrors Slynk) ---------- */

interface AutoMatchOption {
  label: string;
  value: string;
  wooKey: keyof WooProduct;
  eposKey: keyof EposProduct;
}

const AUTO_MATCH_OPTIONS: AutoMatchOption[] = [
  { label: 'SKU ↔ Barcode', value: 'sku|barcode', wooKey: 'sku', eposKey: 'barcode' },
  { label: 'SKU ↔ SKU', value: 'sku|sku', wooKey: 'sku', eposKey: 'sku' },
  { label: 'SKU ↔ Order Code', value: 'sku|orderCode', wooKey: 'sku', eposKey: 'orderCode' },
  { label: 'SKU ↔ Article Code', value: 'sku|articleCode', wooKey: 'sku', eposKey: 'articleCode' },
  { label: 'SKU ↔ ePOS ID', value: 'sku|id', wooKey: 'sku', eposKey: 'id' },
  { label: 'Name ↔ Name', value: 'name|name', wooKey: 'name', eposKey: 'name' },
];

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
    case 'linked-not-found':
      return <Badge color="bg-red-100 text-red-700">Not Found</Badge>;
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
  const [showAutoMatchMenu, setShowAutoMatchMenu] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState<AutoMatchOption | null>(null);

  // Sorting state
  const [eposSortCol, setEposSortCol] = useState<keyof EposProduct>('name');
  const [eposSortDir, setEposSortDir] = useState<'asc' | 'desc'>('asc');
  const [wooSortCol, setWooSortCol] = useState<keyof WooProduct>('name');
  const [wooSortDir, setWooSortDir] = useState<'asc' | 'desc'>('asc');

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

  const hasUnsavedChanges = Object.keys(pendingLinks).length > 0 || Object.keys(pendingUnlinks).length > 0;
  const pendingCount = Object.keys(pendingLinks).length + Object.keys(pendingUnlinks).length;

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

  // Close auto-match menu on outside click
  useEffect(() => {
    if (!showAutoMatchMenu) return;
    const handler = () => setShowAutoMatchMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAutoMatchMenu]);

  /* ---------- link status for a WooCommerce product ---------- */

  const getWooLinkStatus = useCallback(
    (wooId: number): { status: LinkStatus; eposId?: number; eposName?: string; mappingId?: number } => {
      if (pendingUnlinks[wooId]) {
        return { status: 'to-unlink', mappingId: pendingUnlinks[wooId] };
      }
      if (pendingLinks[wooId]) {
        return { status: 'to-save', eposId: pendingLinks[wooId].eposId, eposName: pendingLinks[wooId].eposName };
      }
      const mapping = wooToMapping.get(wooId);
      if (mapping) {
        // Check if the linked ePOS product still exists
        const eposExists = eposProducts.some((ep) => String(ep.id) === mapping.epos_id);
        if (!eposExists && eposProducts.length > 0) {
          return { status: 'linked-not-found', eposId: Number(mapping.epos_id), eposName: mapping.epos_name ?? undefined, mappingId: mapping.id };
        }
        return { status: 'linked', eposId: Number(mapping.epos_id), eposName: mapping.epos_name ?? undefined, mappingId: mapping.id };
      }
      return { status: 'not-linked' };
    },
    [pendingLinks, pendingUnlinks, wooToMapping, eposProducts]
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
      setPendingUnlinks((prev) => ({ ...prev, [wooId]: mapping.id }));
    }
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
      setSuccessMsg(`Saved successfully — ${parts.join(', ')}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- auto-match (mirrors Slynk logic) ---------- */

  const runAutoMatch = (option: AutoMatchOption, overwriteExisting: boolean) => {
    if (eposProducts.length === 0 || wooProducts.length === 0) return;
    setAutoMatching(true);
    setError('');
    setSuccessMsg('');

    const existingWooLinked = new Set<number>();
    const existingEposLinked = new Set<string>();
    if (!overwriteExisting) {
      mappings.forEach((m) => {
        existingWooLinked.add(m.woo_id);
        existingEposLinked.add(m.epos_id);
      });
      Object.values(pendingLinks).forEach((p) => {
        existingWooLinked.add(p.wooId);
        existingEposLinked.add(String(p.eposId));
      });
    }

    // Build ePOS lookup keyed by the chosen field
    const eposLookup = new Map<string, EposProduct>();
    eposProducts.forEach((ep) => {
      if (!overwriteExisting && existingEposLinked.has(String(ep.id))) return;
      const val = String(ep[option.eposKey] ?? '').toLowerCase().trim();
      if (val) eposLookup.set(val, ep);
    });

    const newLinks: Record<number, PendingLink> = {};
    let matchCount = 0;

    wooProducts.forEach((wp) => {
      if (!overwriteExisting && existingWooLinked.has(wp.id)) return;
      const val = String(wp[option.wooKey] ?? '').toLowerCase().trim();
      if (!val) return;
      const match = eposLookup.get(val);
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
        // Remove from lookup so one ePOS product only matches one WC product
        eposLookup.delete(val);
        matchCount++;
      }
    });

    setPendingLinks((prev) => ({ ...prev, ...newLinks }));
    setAutoMatching(false);

    if (matchCount > 0) {
      setSuccessMsg(`Auto-matched ${matchCount} product${matchCount > 1 ? 's' : ''} by ${option.label}. Click "Save All" to confirm.`);
    } else {
      setSuccessMsg(`No new matches found by ${option.label}.`);
    }
  };

  const handleUnlinkAll = () => {
    if (!confirm('Are you sure you want to unlink ALL products? This will mark all existing links for removal.')) return;

    const newUnlinks: Record<number, number> = {};
    mappings.forEach((m) => {
      newUnlinks[m.woo_id] = m.id;
    });
    setPendingUnlinks((prev) => ({ ...prev, ...newUnlinks }));
    // Also clear any pending links
    setPendingLinks({});
    setSuccessMsg(`${Object.keys(newUnlinks).length} product(s) marked for unlinking. Click "Save All" to confirm.`);
  };

  /* ---------- sorting helpers ---------- */

  function toggleEposSort(col: keyof EposProduct) {
    if (eposSortCol === col) setEposSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setEposSortCol(col); setEposSortDir('asc'); }
  }

  function toggleWooSort(col: keyof WooProduct) {
    if (wooSortCol === col) setWooSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setWooSortCol(col); setWooSortDir('asc'); }
  }

  function sortIndicator(active: boolean, dir: 'asc' | 'desc') {
    if (!active) return null;
    return <span className="ml-0.5 text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>;
  }

  /* ---------- filtered & sorted lists ---------- */

  const filteredEpos = useMemo(() => {
    const q = searchEpos.toLowerCase();
    const filtered = eposProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.orderCode && p.orderCode.toLowerCase().includes(q))
    );
    return filtered.sort((a, b) => {
      const aVal = String(a[eposSortCol] ?? '').toLowerCase();
      const bVal = String(b[eposSortCol] ?? '').toLowerCase();
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return eposSortDir === 'asc' ? cmp : -cmp;
    });
  }, [eposProducts, searchEpos, eposSortCol, eposSortDir]);

  const filteredWoo = useMemo(() => {
    const q = searchWoo.toLowerCase();
    const filtered = wooProducts.filter((p) => {
      if (
        !p.name.toLowerCase().includes(q) &&
        !String(p.id).includes(q) &&
        !(p.sku && p.sku.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filterLinked === 'linked') {
        const { status } = getWooLinkStatus(p.id);
        return status === 'linked' || status === 'to-save' || status === 'linked-not-found';
      }
      if (filterLinked === 'unlinked') {
        const { status } = getWooLinkStatus(p.id);
        return status === 'not-linked' || status === 'to-unlink';
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const aVal = String(a[wooSortCol] ?? '').toLowerCase();
      const bVal = String(b[wooSortCol] ?? '').toLowerCase();
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return wooSortDir === 'asc' ? cmp : -cmp;
    });
  }, [wooProducts, searchWoo, filterLinked, getWooLinkStatus, wooSortCol, wooSortDir]);

  /* ---------- render ---------- */

  const SortableHeader = ({
    label,
    colKey,
    table,
    className = '',
  }: {
    label: string;
    colKey: string;
    table: 'epos' | 'woo';
    className?: string;
  }) => {
    const isEpos = table === 'epos';
    const active = isEpos ? eposSortCol === colKey : wooSortCol === colKey;
    const dir = isEpos ? eposSortDir : wooSortDir;
    return (
      <th
        className={`px-3 py-2 text-left font-medium text-slate-500 text-xs cursor-pointer select-none hover:text-slate-700 ${className}`}
        onClick={() => isEpos ? toggleEposSort(colKey as keyof EposProduct) : toggleWooSort(colKey as keyof WooProduct)}
      >
        {label}{sortIndicator(active, dir)}
      </th>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Product Links</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Select an ePOS Now product, then click &quot;Link&quot; on a WooCommerce product to pair them.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-match dropdown */}
          <div className="relative">
            <button
              disabled={autoMatching || eposProducts.length === 0 || wooProducts.length === 0}
              onClick={(e) => { e.stopPropagation(); setShowAutoMatchMenu((v) => !v); }}
              className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              <Wand2 className={`w-4 h-4 ${autoMatching ? 'animate-spin' : ''}`} />
              Auto-Match
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAutoMatchMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-56 z-20"
                onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Match by field</div>
                {AUTO_MATCH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setShowAutoMatchMenu(false); setShowOverwriteDialog(opt); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => { setShowAutoMatchMenu(false); handleUnlinkAll(); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Unlink All Products
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save all */}
          <button
            onClick={handleSaveAll}
            disabled={!hasUnsavedChanges || saving}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : `Save All${hasUnsavedChanges ? ` (${pendingCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* Overwrite dialog */}
      {showOverwriteDialog && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowOverwriteDialog(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Find Matches — {showOverwriteDialog.label}</h3>
            <p className="text-sm text-slate-600 mb-4">
              Overwrite existing product links if a new match is found?
              We recommend finding new matches only as this is much faster.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { const opt = showOverwriteDialog; setShowOverwriteDialog(null); runAutoMatch(opt, false); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                New Matches Only
              </button>
              <button
                onClick={() => { const opt = showOverwriteDialog; setShowOverwriteDialog(null); runAutoMatch(opt, true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Overwrite Existing
              </button>
              <button
                onClick={() => setShowOverwriteDialog(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasUnsavedChanges && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You have {pendingCount} unsaved change(s). Click &quot;Save All&quot; to apply.
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
          <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-blue-700 text-sm">
              ePOS Now Products
              <span className="ml-2 text-blue-400 font-normal">({eposProducts.length})</span>
            </h2>
            {selectedEpos && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                ✓ Selected: {selectedEpos.name}
              </span>
            )}
          </div>

          {/* Search + refresh */}
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ID, barcode, SKU…"
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
              <span className="ml-2 text-sm text-slate-400">Loading ePOS products…</span>
            </div>
          ) : filteredEpos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 flex-1">
              <PackageSearch className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">
                {eposProducts.length === 0 ? 'No ePOS products loaded.' : 'No matches.'}
              </p>
            </div>
          ) : (
            <div className="overflow-auto flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <SortableHeader label="Product Name" colKey="name" table="epos" />
                    <SortableHeader label="ID" colKey="id" table="epos" className="w-16" />
                    <SortableHeader label="SKU" colKey="sku" table="epos" className="w-20" />
                    <SortableHeader label="Barcode" colKey="barcode" table="epos" className="w-24" />
                    <SortableHeader label="Price" colKey="salePrice" table="epos" className="w-18" />
                    <th className="px-3 py-2 text-center font-medium text-slate-500 text-xs w-16">Status</th>
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
                        <td className="px-3 py-2 font-medium text-slate-700 max-w-[180px] truncate" title={p.name}>
                          {p.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{p.id}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[80px]" title={p.sku}>{p.sku || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[100px]" title={p.barcode}>{p.barcode || '—'}</td>
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
              <span className="ml-2 text-sm text-slate-400">Loading WooCommerce products…</span>
            </div>
          ) : filteredWoo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 flex-1">
              <PackageSearch className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">
                {wooProducts.length === 0 ? 'No WooCommerce products loaded.' : 'No matches.'}
              </p>
            </div>
          ) : (
            <div className="overflow-auto flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-center font-medium text-slate-500 text-xs w-16">Action</th>
                    <SortableHeader label="Product Name" colKey="name" table="woo" />
                    <SortableHeader label="ID" colKey="id" table="woo" className="w-14" />
                    <SortableHeader label="SKU" colKey="sku" table="woo" className="w-20" />
                    <SortableHeader label="Type" colKey="type" table="woo" className="w-16" />
                    <SortableHeader label="Status" colKey="status" table="woo" className="w-16" />
                    <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs w-32">Linked EPN</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-500 text-xs w-20">Link Status</th>
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
                              : linkInfo.status === 'linked-not-found'
                                ? 'bg-red-50/30'
                                : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Action / Link-Unlink button */}
                        <td className="px-3 py-2 text-center">
                          {linkInfo.status === 'to-save' || linkInfo.status === 'to-unlink' ? (
                            <button
                              onClick={() => handleCancelPending(p.id)}
                              className="text-[11px] text-slate-500 hover:text-slate-700 font-medium border border-slate-200 rounded px-2 py-0.5"
                            >
                              Undo
                            </button>
                          ) : linkInfo.status === 'linked' || linkInfo.status === 'linked-not-found' ? (
                            <button
                              onClick={() => handleUnlinkWoo(p.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium border border-red-200 rounded px-2 py-0.5 hover:bg-red-50"
                            >
                              <Unlink className="w-3 h-3" />
                              Unlink
                            </button>
                          ) : selectedEpos ? (
                            <button
                              onClick={() => handleLinkWoo(p)}
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50"
                            >
                              <Link2 className="w-3 h-3" />
                              Link
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700 max-w-[180px] truncate" title={p.name}>
                          {p.name}
                          {p.parentName && (
                            <span className="block text-[10px] text-slate-400 truncate">Parent: {p.parentName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{p.id}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[80px]" title={p.sku}>{p.sku || '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-medium ${
                            p.type === 'variation' ? 'bg-violet-100 text-violet-600'
                            : p.type === 'variable' ? 'bg-orange-100 text-orange-600'
                            : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-medium ${
                            p.status === 'publish' ? 'bg-green-100 text-green-600'
                            : p.status === 'draft' ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[130px]" title={linkInfo.eposName ?? ''}>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ──── Saved Links Summary ──── */}
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
