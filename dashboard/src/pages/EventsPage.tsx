import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ANOMALY_EVENTS, CHANNELS, CHANNEL_LABELS, TELEMANOM_THRESHOLD,
  type AnomalyEvent, type Priority
} from '../data/telemetry';
import { Search, X, Filter, ChevronRight, AlertTriangle, Check } from 'lucide-react';

// ─── Priority styling ─────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  urgent:       { label: 'Urgent Review',        color: 'text-red-400',   bg: 'bg-red-500/10',     border: 'border-red-500/30',   dot: 'bg-red-400'   },
  engineering:  { label: 'Engineering Review',   color: 'text-amber-400', bg: 'bg-amber-500/10',   border: 'border-amber-500/30', dot: 'bg-amber-400' },
  routine:      { label: 'Routine Monitoring',   color: 'text-blue-400',  bg: 'bg-blue-500/10',    border: 'border-blue-500/30',  dot: 'bg-blue-400'  },
  insufficient: { label: 'Insufficient Evidence', color: 'text-gray-500', bg: 'bg-white/[0.03]',   border: 'border-white/10',    dot: 'bg-gray-600'  },
};

// ─── Event detail drawer ──────────────────────────────────────────────────────
const EventDrawer = ({ event, onClose }: { event: AnomalyEvent; onClose: () => void }) => {
  const [tab, setTab] = useState<'overview' | 'triage' | 'evidence'>('overview');
  const p = PRIORITY_CFG[event.priority];
  const threshold = TELEMANOM_THRESHOLD[event.channel as keyof typeof TELEMANOM_THRESHOLD];

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-14 right-0 bottom-0 w-full md:w-[520px] bg-[#07101d] border-l border-[#1a2a3d] z-50 flex flex-col shadow-2xl"
    >
      {/* Drawer header */}
      <div className="px-6 py-4 border-b border-[#1a2a3d] flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[13px] font-bold text-cyan-400">{event.id}</span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
              event.detector === 'telemanom' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              {event.detector === 'telemanom' ? 'Telemanom' : 'Isolation Forest'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-gray-500">
            Channel {event.channel} · {CHANNEL_LABELS[event.channel as keyof typeof CHANNEL_LABELS]} · Idx {event.startIdx}–{event.endIdx}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-sm hover:bg-white/5">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a2a3d] flex-shrink-0">
        {(['overview', 'triage', 'evidence'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-[11px] font-mono tracking-wider uppercase border-b-2 transition-colors ${
              tab === t
                ? 'text-white border-cyan-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Interval */}
              <div>
                <h4 className="text-[11px] font-mono text-gray-600 uppercase tracking-wider mb-3">Detection interval</h4>
                <div className="grid grid-cols-3 gap-px bg-[#1a2a3d]">
                  {[
                    { label: 'Start idx', value: event.startIdx },
                    { label: 'End idx', value: event.endIdx },
                    { label: 'Duration', value: `${event.duration} samp.` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0a1829] px-4 py-3">
                      <div className="text-[20px] font-bold text-white tabular-nums">{value}</div>
                      <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              <div>
                <h4 className="text-[11px] font-mono text-gray-600 uppercase tracking-wider mb-3">Detection evidence</h4>
                <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-gray-500">Mean channel error</span>
                    <span className={`text-[13px] font-mono font-bold ${event.channelError > 0.05 ? 'text-amber-400' : 'text-white'}`}>
                      {event.channelError.toFixed(5)}
                    </span>
                  </div>
                  {threshold !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono text-gray-500">Dynamic threshold</span>
                      <span className="text-[13px] font-mono text-gray-300">{threshold}</span>
                    </div>
                  )}
                  {threshold !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono text-gray-500">Threshold multiplier</span>
                      <span className="text-[13px] font-mono text-white">
                        {(event.channelError / threshold).toFixed(1)}×
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[#1a2a3d]">
                    <span className="text-[11px] font-mono text-gray-500">Detector method</span>
                    <span className="text-[10px] font-mono text-gray-400 max-w-[260px] text-right leading-relaxed">{event.detectorMethod}</span>
                  </div>
                </div>
              </div>

              {/* Agreement */}
              <div>
                <h4 className="text-[11px] font-mono text-gray-600 uppercase tracking-wider mb-3">Detector agreement</h4>
                <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-4">
                  {event.matchedEventId ? (
                    <div className="flex items-start gap-3">
                      <Check size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[12px] text-white font-medium mb-1">
                          Matched with {event.matchedEventId}
                        </p>
                        <p className="text-[11px] font-mono text-gray-500 leading-relaxed">
                          Both detectors identified overlapping intervals on channel {event.channel}.
                          This increases investigation confidence.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={15} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[12px] text-gray-300 font-medium mb-1">No matching event</p>
                        <p className="text-[11px] font-mono text-gray-500 leading-relaxed">
                          Only one detector flagged this interval. No cross-detector agreement.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'triage' && (
            <motion.div key="triage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Priority */}
              <div className={`p-5 rounded-sm border ${p.bg} ${p.border} relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 w-0.5 h-full ${p.dot}`} />
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                  <span className={`text-[15px] font-bold ${p.color}`}>{p.label}</span>
                </div>
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  {event.priority === 'engineering' && 'Both detectors identified overlapping intervals. Channel error significantly above threshold. Sustained deviation requires engineering investigation.'}
                  {event.priority === 'routine' && 'Multi-detector detection with moderate error. Values remain within operational bounds. Classified as routine monitoring.'}
                  {event.priority === 'insufficient' && 'Single detector flagged this interval. Short duration and marginal error. Insufficient evidence for escalation.'}
                  {event.priority === 'urgent' && 'Critical threshold exceeded. Immediate review required.'}
                </p>
              </div>

              {/* Reasons */}
              <div>
                <h4 className="text-[11px] font-mono text-gray-600 uppercase tracking-wider mb-3">Triage reasons</h4>
                <ul className="space-y-2">
                  {event.priorityReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-[12px] text-gray-400 leading-relaxed">
                      <span className="flex-shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center rounded-full bg-[#0a1829] border border-[#1a2a3d] text-[9px] font-mono text-gray-600">
                        {i + 1}
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
                <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
                  Triage is rule-based. Labeled anomaly classes from the original dataset are not used as triage inputs.
                  Priority does not confirm a physical subsystem failure.
                </p>
              </div>
            </motion.div>
          )}

          {tab === 'evidence' && (
            <motion.div key="evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#0a1829] border border-[#1a2a3d] rounded-sm text-[10px] font-mono text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                RAG NOT CONNECTED · Displaying static reference documents only
              </div>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                No retrieved passages. See Evidence & Documentation page for reference material on the detection methods.
              </p>
              <div className="p-3 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
                <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
                  No supporting documentation has been retrieved for this specific event.
                  General methodology references are available on the Evidence page.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─── Main events page ─────────────────────────────────────────────────────────
export const EventsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [detectorFilter, setDetectorFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<AnomalyEvent | null>(null);

  const filtered = useMemo(() => {
    return ANOMALY_EVENTS.filter(e => {
      if (query && !e.id.toLowerCase().includes(query.toLowerCase()) && !e.channel.toLowerCase().includes(query.toLowerCase())) return false;
      if (detectorFilter !== 'all' && e.detector !== detectorFilter) return false;
      if (priorityFilter !== 'all' && e.priority !== priorityFilter) return false;
      if (channelFilter !== 'all' && e.channel !== channelFilter) return false;
      return true;
    });
  }, [query, detectorFilter, priorityFilter, channelFilter]);

  const hasFilters = query || detectorFilter !== 'all' || priorityFilter !== 'all' || channelFilter !== 'all';

  const clearAll = () => {
    setQuery('');
    setDetectorFilter('all');
    setPriorityFilter('all');
    setChannelFilter('all');
  };

  const uniqueChannels = [...new Set(ANOMALY_EVENTS.map(e => e.channel))];

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-white leading-tight mb-1.5 font-space-grotesk">
          Anomaly Events
        </h1>
        <p className="text-[13px] text-gray-500">
          All detected events across channels and detectors. Click a row to open the investigation drawer.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0a1829] border border-[#1a2a3d] rounded-sm min-w-[200px]">
          <Search size={13} className="text-gray-500 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search event ID or channel…"
            className="flex-1 bg-transparent text-[12px] font-mono text-gray-200 placeholder:text-gray-600 outline-none"
          />
        </div>

        {/* Detector filter */}
        <select
          value={detectorFilter}
          onChange={e => setDetectorFilter(e.target.value)}
          className="px-3 py-2 bg-[#0a1829] border border-[#1a2a3d] text-[11px] font-mono text-gray-300 rounded-sm outline-none hover:border-[#2a4a6a] transition-colors"
        >
          <option value="all">All detectors</option>
          <option value="telemanom">Telemanom</option>
          <option value="isolation_forest">Isolation Forest</option>
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-[#0a1829] border border-[#1a2a3d] text-[11px] font-mono text-gray-300 rounded-sm outline-none hover:border-[#2a4a6a] transition-colors"
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent Review</option>
          <option value="engineering">Engineering Review</option>
          <option value="routine">Routine Monitoring</option>
          <option value="insufficient">Insufficient Evidence</option>
        </select>

        {/* Channel filter */}
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="px-3 py-2 bg-[#0a1829] border border-[#1a2a3d] text-[11px] font-mono text-gray-300 rounded-sm outline-none hover:border-[#2a4a6a] transition-colors"
        >
          <option value="all">All channels</option>
          {uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearAll} className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500 hover:text-gray-300 transition-colors">
            <X size={12} />
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[11px] font-mono text-gray-600">
          {filtered.length} / {ANOMALY_EVENTS.length} events
        </span>
      </div>

      {/* Table */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a2a3d]">
              {['Event ID', 'Channel', 'Detector', 'Start', 'End', 'Duration', 'Error', 'Agreement', 'Priority', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[10px] font-mono text-gray-600 uppercase tracking-wider font-normal whitespace-nowrap first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-[12px] font-mono text-gray-600">
                  No events match current filters.
                </td>
              </tr>
            ) : (
              filtered.map((evt, i) => {
                const p = PRIORITY_CFG[evt.priority];
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <motion.tr
                    key={evt.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedEvent(isSelected ? null : evt)}
                    className={`border-b border-[#0f1e2d] cursor-pointer transition-all ${
                      isSelected ? 'bg-cyan-500/[0.06] border-l-2 border-l-cyan-400' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-3 px-4 pl-5">
                      <span className="font-mono text-[12px] text-cyan-400 font-bold">{evt.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[12px] text-gray-200">{evt.channel}</div>
                      <div className="text-[10px] font-mono text-gray-600">{CHANNEL_LABELS[evt.channel as keyof typeof CHANNEL_LABELS]}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${
                        evt.detector === 'telemanom' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {evt.detector === 'telemanom' ? 'Telemanom' : 'Iso. Forest'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] text-gray-400 tabular-nums">{evt.startIdx}</td>
                    <td className="py-3 px-4 font-mono text-[12px] text-gray-400 tabular-nums">{evt.endIdx}</td>
                    <td className="py-3 px-4 font-mono text-[12px] text-gray-400 tabular-nums">{evt.duration}</td>
                    <td className="py-3 px-4">
                      <span className={`font-mono text-[12px] tabular-nums ${evt.channelError > 0.05 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {evt.channelError.toFixed(3)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {evt.matchedEventId ? (
                        <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">{evt.matchedEventId}</span>
                      ) : (
                        <span className="text-[10px] font-mono text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`flex items-center gap-1.5 ${p.color} whitespace-nowrap`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                        <span className="text-[10px] font-mono">{p.label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 pr-5">
                      <ChevronRight size={14} className={`${isSelected ? 'text-cyan-400' : 'text-gray-600'} transition-colors`} />
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Event drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedEvent(null)}
            />
            <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
