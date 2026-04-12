'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ScrollText, CheckCircle2, XCircle, Info } from 'lucide-react';

interface SyncLog {
  id: number;
  created_at: string;
  type: string;
  status: string;
  message: string;
  details: string | null;
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs?limit=200');
      const data = await res.json();
      setLogs(data.logs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sync Logs</h1>
          <p className="text-slate-500 mt-1">Audit trail of all sync activity.</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-100">
          <ScrollText className="w-10 h-10 mb-3 text-slate-300" />
          <p className="text-sm">No sync logs yet.</p>
          <p className="text-xs mt-1">Run a sync to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const cfg = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.info;
            const Icon = cfg.icon;
            const isExpanded = expanded === log.id;

            return (
              <div
                key={log.id}
                className={`border rounded-lg overflow-hidden ${cfg.bg}`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700 text-sm">{log.message}</span>
                      <span className="text-xs px-2 py-0.5 bg-white/60 rounded-full text-slate-500 font-mono">
                        {log.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  {log.details && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                {isExpanded && log.details && (
                  <div className="px-4 pb-4 pt-0">
                    <pre className="text-xs bg-white/80 rounded p-3 overflow-x-auto text-slate-600">
                      {JSON.stringify(JSON.parse(log.details), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
