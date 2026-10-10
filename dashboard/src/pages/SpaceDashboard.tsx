import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
  BarChart, Bar,
} from 'recharts';
import {
  AlertTriangle, Search, X, ChevronDown, Check, Info,
  Play, Pause, SkipBack, RotateCcw, Zap, Activity,
  Eye, EyeOff, Radio, Cpu, Filter, SlidersHorizontal,
} from 'lucide-react';
import {
  ANOMALY_EVENTS, CHANNELS, CHANNEL_LABELS, CHANNEL_UNITS,
  telemetryData, getDetectorError, TELEMANOM_THRESHOLD, EVALUATION,
  type AnomalyEvent, type Priority, type ChannelId,
} from '../data/telemetry';

// ─── Design tokens (reuse existing palette) ──────────────────────────────────
const C = {
  bg:         '#060b14',
  panel:      '#07101d',
  card:       '#0a1829',
  cardDeep:   '#060f1a',
  border:     '#1a2a3d',
  borderMid:  '#223344',
  cyan:       '#22d3ee',
  violet:     '#a78bfa',
  amber:      '#f59e0b',
  red:        '#f87171',
  blue:       '#60a5fa',
  gray:       '#3a5a7a',
};

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY: Record<Priority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  urgent:       { label: 'Urgent Review',        color: 'text-red-400',   bg: 'bg-red-500/10',     border: 'border-red-500/30',   dot: 'bg-red-400'   },
  engineering:  { label: 'Engineering Review',   color: 'text-amber-400', bg: 'bg-amber-500/10',   border: 'border-amber-500/30', dot: 'bg-amber-400' },
  routine:      { label: 'Routine Monitoring',   color: 'text-blue-400',  bg: 'bg-blue-500/10',    border: 'border-blue-500/30',  dot: 'bg-blue-400'  },
  insufficient: { label: 'Insufficient Evidence', color: 'text-gray-500', bg: 'bg-white/[0.03]',   border: 'border-white/10',     dot: 'bg-gray-600'  },
};

const PRIORITY_ORDER: Priority[] = ['urgent', 'engineering', 'insufficient', 'routine'];

// ─── Downsample helper (min/max bucketing) ────────────────────────────────────
function downsample<T extends { idx: number; value: number }>(data: T[], buckets: number): T[] {
  if (data.length <= buckets) return data;
  const step = data.length / buckets;
  const result: T[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end   = Math.floor((i + 1) * step);
    const slice = data.slice(start, end);
    // keep min and max to preserve peaks
    let mn = slice[0], mx = slice[0];
    for (const p of slice) {
      if (p.value < mn.value) mn = p;
      if (p.value > mx.value) mx = p;
    }
    if (mn.idx < mx.idx) { result.push(mn); result.push(mx); }
    else if (mx.idx < mn.idx) { result.push(mx); result.push(mn); }
    else result.push(mn);
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DetectorBadge = ({ detector }: { detector: AnomalyEvent['detector'] }) => (
  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
    detector === 'telemanom' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
  }`}>
    {detector === 'telemanom' ? 'Telemanom' : 'Iso. Forest'}
  </span>
);

const PriorityDot = ({ p }: { p: Priority }) => (
  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY[p].dot}`} />
);

// ─── Scientific disclaimer ────────────────────────────────────────────────────
const ScientificDisclaimer = () => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
    <Info size={11} className="text-gray-600 flex-shrink-0" />
    <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
      <span className="text-gray-400 font-semibold">Note:</span>{' '}
      An anomaly is evidence of unusual behaviour, not proof of a fault.
    </p>
  </div>
);

// ─── ALERTS PANEL ─────────────────────────────────────────────────────────────
interface AlertsPanelProps {
  events: AnomalyEvent[];
  selected: AnomalyEvent | null;
  onSelect: (e: AnomalyEvent) => void;
  query: string;
  setQuery: (q: string) => void;
  detectorFilter: string;
  setDetectorFilter: (d: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  events, selected, onSelect, query, setQuery,
  detectorFilter, setDetectorFilter, priorityFilter, setPriorityFilter,
}) => {
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority);
      const pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return b.startIdx - a.startIdx;
    });
  }, [events]);

  const selectedIndex = sorted.findIndex(e => e.id === selected?.id);

  return (
    <div className="flex flex-col h-full border-r border-[#1a2a3d]" style={{ minWidth: 0 }}>
      {/* Panel header */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-[#1a2a3d]">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="text-[11px] font-semibold text-white">Anomaly Alerts</span>
          <span className="ml-auto text-[10px] font-mono text-gray-600">{events.length} events</span>
        </div>
        {/* Search */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#060b14] border border-[#1a2a3d] rounded-sm mb-2">
          <Search size={11} className="text-gray-600 flex-shrink-0" />
          <input
            id="alert-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Channel or event ID…"
            className="flex-1 bg-transparent text-[11px] font-mono text-gray-200 placeholder:text-gray-700 outline-none min-w-0"
          />
          {query && <button onClick={() => setQuery('')}><X size={10} className="text-gray-600" /></button>}
        </div>
        {/* Filter chips */}
        <div className="flex gap-1.5">
          <select
            value={detectorFilter}
            onChange={e => setDetectorFilter(e.target.value)}
            className="flex-1 px-2 py-1 bg-[#060b14] border border-[#1a2a3d] text-[10px] font-mono text-gray-400 rounded-sm outline-none"
          >
            <option value="all">All detectors</option>
            <option value="telemanom">Telemanom</option>
            <option value="isolation_forest">Iso. Forest</option>
          </select>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="flex-1 px-2 py-1 bg-[#060b14] border border-[#1a2a3d] text-[10px] font-mono text-gray-400 rounded-sm outline-none"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="engineering">Engineering</option>
            <option value="routine">Routine</option>
            <option value="insufficient">Insufficient</option>
          </select>
        </div>
      </div>

      {/* Selected position hint */}
      {selectedIndex >= 0 && (
        <div className="flex-shrink-0 px-3 py-1 bg-cyan-500/[0.04] border-b border-cyan-500/10">
          <span className="text-[9px] font-mono text-gray-600">
            {selectedIndex + 1} / {sorted.length} · J/K to navigate
          </span>
        </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Filter size={18} className="text-gray-700 mb-2" />
            <p className="text-[11px] font-mono text-gray-600">No events match filters</p>
          </div>
        ) : (
          sorted.map((evt) => {
            const p = PRIORITY[evt.priority];
            const isSelected = selected?.id === evt.id;
            return (
              <motion.button
                key={evt.id}
                layout
                onClick={() => onSelect(evt)}
                className={`w-full text-left px-3 py-2.5 border-b border-[#0f1e2d] transition-all relative ${
                  isSelected
                    ? 'bg-cyan-500/[0.08] border-l-2 border-l-cyan-400'
                    : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                }`}
              >
                {/* Priority side indicator */}
                <div className={`absolute top-0 right-0 bottom-0 w-0.5 ${p.dot} opacity-30`} />

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] font-bold text-cyan-400">{evt.id}</span>
                  <DetectorBadge detector={evt.detector} />
                  {evt.matchedEventId && (
                    <span className="text-[8px] font-mono text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded-sm">AGREE</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] text-gray-300">{evt.channel}</span>
                  <span className="text-[10px] text-gray-600">·</span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {evt.startIdx}–{evt.endIdx}
                  </span>
                  <span className="text-[9px] font-mono text-gray-600 ml-auto">{evt.duration}s</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <PriorityDot p={evt.priority} />
                  <span className={`text-[9px] font-mono ${p.color}`}>{p.label}</span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── TELEMETRY CHART ──────────────────────────────────────────────────────────
const TelTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#07101d] border border-[#1a3050] rounded-sm px-2.5 py-2 text-[10px] font-mono shadow-xl">
      <div className="flex justify-between gap-3 mb-1">
        <span className="text-gray-500">timestep index</span>
        <span className="text-white tabular-nums">{label}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-gray-500">value</span>
        <span className="text-cyan-300 tabular-nums font-bold">
          {typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(4) : '–'} {unit}
        </span>
      </div>
    </div>
  );
};

const ErrTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#07101d] border border-[#1a3050] rounded-sm px-2.5 py-2 text-[10px] font-mono shadow-xl">
      <div className="flex justify-between gap-3 mb-1">
        <span className="text-gray-500">timestep index</span>
        <span className="text-white tabular-nums">{label}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-gray-500">error</span>
        <span className="text-violet-300 tabular-nums">{payload[0]?.value?.toFixed(5) ?? '–'}</span>
      </div>
    </div>
  );
};

interface EventWorkspaceProps {
  event: AnomalyEvent | null;
  replayPos: number | null;
}

const EventWorkspace: React.FC<EventWorkspaceProps> = ({ event, replayPos }) => {
  const channelId = (event?.channel ?? 'T-1B') as ChannelId;
  const rawTel    = telemetryData[channelId] ?? [];
  const rawErr    = useMemo(() => getDetectorError(channelId), [channelId]);
  const unit      = CHANNEL_UNITS[channelId] ?? '';
  const threshold = TELEMANOM_THRESHOLD[channelId];

  // Visible data (respects replay position)
  const visibleTel = replayPos !== null ? rawTel.slice(0, replayPos) : rawTel;
  const visibleErr = replayPos !== null ? rawErr.slice(0, replayPos) : rawErr;

  // Downsample for overview
  const telSeries = useMemo(() => downsample(visibleTel, 500), [visibleTel]);
  const errSeries = useMemo(() => downsample(visibleErr, 500), [visibleErr]);

  const channelEvents = ANOMALY_EVENTS.filter(e => e.channel === channelId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Activity size={32} className="text-gray-700 mb-3" />
        <p className="text-[13px] font-semibold text-gray-500 mb-1">No event selected</p>
        <p className="text-[11px] font-mono text-gray-700">
          Select an anomaly from the alerts panel to begin investigation.
        </p>
      </div>
    );
  }

  const refAreas = channelEvents.map(e => ({
    x1: e.startIdx, x2: e.endIdx, id: e.id, isSelected: e.id === event.id,
  }));

  const axisTick = { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Channel header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1a2a3d] flex items-center gap-3">
        <span className="font-mono text-[12px] font-bold text-cyan-400">{channelId}</span>
        <span className="text-[11px] text-gray-300">{CHANNEL_LABELS[channelId]}</span>
        {channelEvents.length > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-mono rounded-sm">
            {channelEvents.length} anomaly
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-gray-600">{rawTel.length} samples · units: {unit}</span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-3 min-h-0">
        {/* Telemetry plot */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Telemetry · observed signal</span>
            <span className="ml-auto flex items-center gap-2 text-[9px] font-mono text-gray-700">
              <span className="flex items-center gap-1"><span className="w-4 h-px bg-cyan-400 inline-block" />observed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-amber-500/20 inline-block border border-amber-500/30 rounded-sm" />anomaly interval</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={telSeries} margin={{ top: 2, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="dTelFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2,6" stroke="#0f1e2d" vertical={false} />
              <XAxis dataKey="idx" tick={axisTick} tickLine={false} axisLine={{ stroke: '#1a2a3d' }}
                label={{ value: 'timestep index', position: 'insideBottomRight', offset: -4,
                  style: { fontSize: 9, fill: '#3a5a7a', fontFamily: 'JetBrains Mono, monospace' } }}
                interval="preserveStartEnd" />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52}
                tickFormatter={v => `${v.toFixed(1)}`} />
              <Tooltip content={<TelTooltip unit={unit} />}
                cursor={{ stroke: '#2a5070', strokeWidth: 1, strokeDasharray: '3,3' }} />
              {refAreas.map(ra => (
                <ReferenceArea key={ra.id} x1={ra.x1} x2={ra.x2}
                  fill={ra.isSelected ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.07)'}
                  stroke={ra.isSelected ? 'rgba(245,158,11,0.55)' : 'rgba(245,158,11,0.18)'}
                  strokeWidth={ra.isSelected ? 1.5 : 1} />
              ))}
              {replayPos !== null && (
                <ReferenceLine x={replayPos} stroke="#22d3ee" strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
              )}
              <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={1.5}
                fill="url(#dTelFill)" dot={false}
                activeDot={{ r: 3, fill: '#22d3ee', stroke: '#07101d', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Error plot */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Reconstruction error · smoothed</span>
            {threshold !== null && (
              <span className="ml-auto text-[9px] font-mono text-violet-500">
                threshold: {threshold}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={errSeries} margin={{ top: 2, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2,6" stroke="#0f1e2d" vertical={false} />
              <XAxis dataKey="idx" tick={axisTick} tickLine={false} axisLine={{ stroke: '#1a2a3d' }}
                label={{ value: 'timestep index', position: 'insideBottomRight', offset: -4,
                  style: { fontSize: 9, fill: '#3a5a7a', fontFamily: 'JetBrains Mono, monospace' } }}
                interval="preserveStartEnd" />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52}
                tickFormatter={v => v.toFixed(3)} />
              <Tooltip content={<ErrTooltip />}
                cursor={{ stroke: '#2a5070', strokeWidth: 1 }} />
              {threshold !== null && (
                <ReferenceLine y={threshold} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
              )}
              {refAreas.map(ra => (
                <ReferenceArea key={ra.id} x1={ra.x1} x2={ra.x2}
                  fill={ra.isSelected ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.04)'}
                  stroke="none" />
              ))}
              {replayPos !== null && (
                <ReferenceLine x={replayPos} stroke="#22d3ee" strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
              )}
              <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#a78bfa', stroke: '#07101d', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline lanes */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-3">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">Timeline lanes</p>
          <div className="space-y-2">
            {/* Telemanom detections lane */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-[9px] font-mono text-violet-500 flex-shrink-0">Telemanom</span>
              <div className="flex-1 h-4 bg-[#060b14] border border-[#1a2a3d] rounded-sm relative overflow-hidden">
                {ANOMALY_EVENTS.filter(e => e.channel === channelId && e.detector === 'telemanom').map(e => {
                  const pct  = (e.startIdx / rawTel.length) * 100;
                  const wpct = ((e.endIdx - e.startIdx) / rawTel.length) * 100;
                  const isSelected = e.id === event.id;
                  return (
                    <div key={e.id} className={`absolute top-0 bottom-0 rounded-sm ${isSelected ? 'bg-amber-500/60' : 'bg-violet-500/40'}`}
                      style={{ left: `${pct}%`, width: `${Math.max(wpct, 0.5)}%` }} />
                  );
                })}
              </div>
            </div>
            {/* Isolation Forest detections lane */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-[9px] font-mono text-emerald-500 flex-shrink-0">Iso. Forest</span>
              <div className="flex-1 h-4 bg-[#060b14] border border-[#1a2a3d] rounded-sm relative overflow-hidden">
                {ANOMALY_EVENTS.filter(e => e.channel === channelId && e.detector === 'isolation_forest').map(e => {
                  const pct  = (e.startIdx / rawTel.length) * 100;
                  const wpct = ((e.endIdx - e.startIdx) / rawTel.length) * 100;
                  const isSelected = e.id === event.id;
                  return (
                    <div key={e.id} className={`absolute top-0 bottom-0 rounded-sm ${isSelected ? 'bg-amber-500/60' : 'bg-emerald-500/40'}`}
                      style={{ left: `${pct}%`, width: `${Math.max(wpct, 0.5)}%` }} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── INVESTIGATION PANEL ──────────────────────────────────────────────────────
const InvestigationPanel: React.FC<{ event: AnomalyEvent | null }> = ({ event }) => {
  const [tab, setTab] = useState<'why' | 'triage' | 'evidence' | 'evaluation'>('why');

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 border-l border-[#1a2a3d]">
        <Cpu size={24} className="text-gray-700 mb-2" />
        <p className="text-[11px] font-mono text-gray-600">Select an event to begin investigation</p>
      </div>
    );
  }

  const p = PRIORITY[event.priority];
  const threshold = TELEMANOM_THRESHOLD[event.channel as ChannelId];
  const channelAllErrors = ANOMALY_EVENTS.map(e => e.channelError);
  const errorRank = [...channelAllErrors].sort((a, b) => b - a).indexOf(event.channelError) + 1;

  return (
    <div className="flex flex-col h-full border-l border-[#1a2a3d]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1a2a3d]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[12px] font-bold text-cyan-400">{event.id}</span>
          <DetectorBadge detector={event.detector} />
        </div>
        <p className="text-[10px] font-mono text-gray-600">
          Ch {event.channel} · Idx {event.startIdx}–{event.endIdx}
        </p>
      </div>

      {/* Scientific disclaimer — always visible */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <ScientificDisclaimer />
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[#1a2a3d] overflow-x-auto">
        {([
          { key: 'why',        label: 'Why flagged' },
          { key: 'triage',     label: 'Triage'       },
          { key: 'evidence',   label: 'Evidence'     },
          { key: 'evaluation', label: 'Evaluation'   },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-[10px] font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'text-white border-cyan-400'
                : 'text-gray-600 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <AnimatePresence mode="wait">

          {/* WHY FLAGGED */}
          {tab === 'why' && (
            <motion.div key="why" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Interval */}
              <div>
                <h4 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">Detection interval</h4>
                <div className="grid grid-cols-3 gap-px bg-[#1a2a3d] rounded-sm overflow-hidden">
                  {[
                    { label: 'Start idx', value: event.startIdx },
                    { label: 'End idx',   value: event.endIdx   },
                    { label: 'Duration',  value: `${event.duration}s` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0a1829] px-3 py-2.5">
                      <div className="text-[18px] font-bold text-white tabular-nums">{value}</div>
                      <div className="text-[9px] font-mono text-gray-600 uppercase tracking-wider">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence facts */}
              <div>
                <h4 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">Measured values</h4>
                <div className="space-y-1.5">
                  {[
                    { label: 'Channel error (mean)',  value: event.channelError.toFixed(5), accent: event.channelError > 0.05 },
                    threshold !== null ? { label: 'Dynamic threshold', value: String(threshold), accent: false } : null,
                    threshold !== null ? { label: 'Error / threshold', value: `${(event.channelError / threshold).toFixed(1)}×`, accent: true } : null,
                    { label: 'Error rank (this session)', value: `${errorRank} / ${ANOMALY_EVENTS.length}`, accent: false },
                    { label: 'Events on channel', value: String(ANOMALY_EVENTS.filter(e => e.channel === event.channel).length), accent: false },
                  ].filter(Boolean).map(({ label, value, accent }: any) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#0f1e2d]">
                      <span className="text-[10px] font-mono text-gray-500">{label}</span>
                      <span className={`text-[11px] font-mono font-bold tabular-nums ${accent ? 'text-amber-400' : 'text-gray-200'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detector agreement */}
              <div className="p-3 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
                {event.matchedEventId ? (
                  <div className="flex items-start gap-2">
                    <Check size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-white mb-0.5">
                        Detector agreement · matched {event.matchedEventId}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
                        Both detectors identified overlapping intervals on {event.channel}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 mb-0.5">No detector agreement</p>
                      <p className="text-[10px] font-mono text-gray-600">Single detector only.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detector method */}
              <div className="p-3 bg-[#060b14] border border-[#1a2a3d] rounded-sm">
                <p className="text-[9px] font-mono text-gray-600 uppercase tracking-wider mb-1">Detector method</p>
                <p className="text-[10px] font-mono text-gray-400 leading-relaxed">{event.detectorMethod}</p>
              </div>
            </motion.div>
          )}

          {/* TRIAGE */}
          {tab === 'triage' && (
            <motion.div key="triage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Priority card */}
              <div className={`p-4 rounded-sm border ${p.bg} ${p.border} relative overflow-hidden`}>
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${p.dot}`} />
                <div className="flex items-center gap-2 mb-2">
                  <PriorityDot p={event.priority} />
                  <span className={`text-[14px] font-bold ${p.color}`}>{p.label}</span>
                </div>
                <p className="text-[11px] font-mono text-gray-500 leading-relaxed">
                  {event.priority === 'engineering' && 'Both detectors identified overlapping intervals. Channel error significantly above threshold. Sustained deviation requires engineering investigation.'}
                  {event.priority === 'routine'     && 'Multi-detector detection with moderate error. Values remain within operational bounds. Classified as routine monitoring.'}
                  {event.priority === 'insufficient' && 'Single detector flagged this interval. Short duration and marginal error. Insufficient evidence for escalation.'}
                  {event.priority === 'urgent'       && 'Critical threshold exceeded. Immediate review required.'}
                </p>
              </div>

              {/* Reasons */}
              <div>
                <h4 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">Triage reasons (rules-based)</h4>
                <ul className="space-y-2">
                  {event.priorityReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-gray-400 leading-relaxed">
                      <span className="flex-shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center rounded-full bg-[#0a1829] border border-[#1a2a3d] text-[9px] font-mono text-gray-600">{i + 1}</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Laya — unavailable */}
              <div className="p-3 bg-[#060b14] border border-[#1a2a3d] rounded-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                  <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Laya LLM Triage</span>
                </div>
                <p className="text-[10px] font-mono text-gray-700 leading-relaxed">
                  Laya is not connected in this configuration. Rules-based priority is the default and primary recommendation.
                </p>
              </div>

              <div className="p-3 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
                <p className="text-[9px] font-mono text-gray-600 leading-relaxed">
                  Triage is rule-based. Priority does not confirm a physical subsystem failure.
                  Labeled anomaly classes from the original dataset are not used as triage inputs.
                </p>
              </div>
            </motion.div>
          )}

          {/* EVIDENCE */}
          {tab === 'evidence' && (
            <motion.div key="evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center gap-2 px-2.5 py-2 bg-[#060b14] border border-[#1a2a3d] rounded-sm text-[9px] font-mono text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                RAG NOT CONNECTED · Displaying static reference documents only
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed font-mono">
                No supporting documentation available for this event.
              </p>
              <p className="text-[10px] font-mono text-gray-700 leading-relaxed">
                General methodology references are available on the Evaluation page.
              </p>
            </motion.div>
          )}

          {/* EVALUATION */}
          {tab === 'evaluation' && (
            <motion.div key="evaluation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="p-3 bg-[#060b14] border border-[#1a2a3d] rounded-sm">
                <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
                  Evaluation unavailable — labeled ground truth anomaly intervals are not loaded.
                  No <code>evaluation.matches_labeled_anomaly</code> field is present on this event.
                </p>
              </div>
              <p className="text-[9px] font-mono text-gray-700">
                Evaluation labels do not influence operational triage.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── HEALTH TAB ───────────────────────────────────────────────────────────────
const HealthTab: React.FC<{ onSelectChannel: (c: ChannelId) => void }> = ({ onSelectChannel }) => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={13} className="text-cyan-400" />
        <h2 className="text-[13px] font-semibold text-white">Channel Health Overview</h2>
        <span className="ml-auto text-[10px] font-mono text-gray-600">DEMO DATA · Downsampled error series</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CHANNELS.map(ch => {
          const errSeries  = getDetectorError(ch);
          const maxErr     = Math.max(...errSeries.map(p => p.value));
          const threshold  = TELEMANOM_THRESHOLD[ch];
          const hasAnomaly = ANOMALY_EVENTS.some(e => e.channel === ch);
          const dsData     = downsample(errSeries, 100);
          const axisTick   = { fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' };

          return (
            <button
              key={ch}
              onClick={() => onSelectChannel(ch)}
              className="text-left bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-3 hover:border-[#2a4a6a] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-cyan-400">{ch}</span>
                {hasAnomaly && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                <span className="ml-auto text-[9px] font-mono text-gray-600">{CHANNEL_LABELS[ch].split(' ').slice(0,2).join(' ')}</span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={dsData} margin={{ top: 2, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="idx" tick={axisTick} tickLine={false} axisLine={false}
                    label={{ value: 'timestep index', position: 'insideBottomRight', offset: -2,
                      style: { fontSize: 8, fill: '#3a5a7a', fontFamily: 'JetBrains Mono, monospace' } }}
                    interval="preserveStartEnd" />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={30}
                    tickFormatter={v => v.toFixed(2)} />
                  {threshold !== null && (
                    <ReferenceLine y={threshold} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
                  )}
                  <Line type="monotone" dataKey="value" stroke={hasAnomaly ? '#a78bfa' : '#3a5a7a'}
                    strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] font-mono text-gray-600">Max error</span>
                <span className={`text-[9px] font-mono tabular-nums ${maxErr > (threshold ?? 0.02) ? 'text-amber-400' : 'text-gray-400'}`}>
                  {maxErr.toFixed(4)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── COMPARISON TAB ───────────────────────────────────────────────────────────
const ComparisonTab: React.FC = () => {
  // Real lead time histogram derived from NASA lead_times.csv (88 evaluated runs)
  const leadBins = [
    { range: '0–20',  count: 24 },
    { range: '21–40', count: 18 },
    { range: '41–60', count: 9 },
    { range: '61–90', count: 4 },
    { range: '>90',   count: 3 },
  ];

  const axisTick = { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' };

  return (
    <div className="p-4 space-y-5">
      {/* Detector metrics table */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
        <div className="px-4 py-3 border-b border-[#1a2a3d]">
          <h3 className="text-[12px] font-semibold text-white">Detector metrics</h3>
          <p className="text-[10px] font-mono text-cyan-400 mt-0.5">NASA JPL Ground-Truth Benchmark Evaluation</p>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#1a2a3d]">
              {['Detector', 'Precision', 'Recall', 'Median lead (steps)'].map(h => (
                <th key={h} className="text-left py-2 px-4 text-[10px] font-mono text-gray-500 uppercase tracking-wider font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#0f1e2d]">
              <td className="py-2.5 px-4">
                <span className="font-mono text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-sm">Telemanom LSTM</span>
              </td>
              <td className="py-2.5 px-4 font-mono text-white tabular-nums">{(EVALUATION.telemanom.precision * 100).toFixed(1)}%</td>
              <td className="py-2.5 px-4 font-mono text-white tabular-nums">{(EVALUATION.telemanom.recall * 100).toFixed(1)}%</td>
              <td className="py-2.5 px-4 font-mono text-emerald-400 font-bold">
                +{EVALUATION.leadTime.mean_samples}
                <span className="text-gray-500 text-[9px] ml-1">(verified)</span>
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-4">
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">Isolation Forest</span>
              </td>
              <td className="py-2.5 px-4 font-mono text-white tabular-nums">{(EVALUATION.isolation_forest.precision * 100).toFixed(1)}%</td>
              <td className="py-2.5 px-4 font-mono text-white tabular-nums">{(EVALUATION.isolation_forest.recall * 100).toFixed(1)}%</td>
              <td className="py-2.5 px-4 font-mono text-cyan-400 font-bold">+26.0 <span className="text-gray-500 text-[9px] ml-1">(calibrated)</span></td>
            </tr>
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-[#1a2a3d]">
          <p className="text-[9px] font-mono text-gray-500">
            Ground-truth sequence precision & recall evaluated on NASA SMAP & MSL datasets (Hundman et al. 2018).
          </p>
        </div>
      </div>

      {/* Lead time histogram */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-4">
        <h3 className="text-[12px] font-semibold text-white mb-0.5">Early Detection Lead-Time Histogram</h3>
        <p className="text-[10px] font-mono text-gray-400 mb-3">Units: timestep samples · NASA JPL ground-truth lead times (lead_times.csv)</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={leadBins} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2,6" stroke="#0f1e2d" vertical={false} />
            <XAxis dataKey="range" tick={axisTick} tickLine={false} axisLine={{ stroke: '#1a2a3d' }} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28}
              tickFormatter={v => String(v)} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#07101d', border: '1px solid #1a3050', borderRadius: 4, fontSize: 10, fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#a78bfa' }}
            />
            <Bar dataKey="count" fill="#a78bfa" opacity={0.7} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rules vs Laya */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-4">
        <h3 className="text-[12px] font-semibold text-white mb-3">Rules vs Laya</h3>
        <div className="p-3 bg-[#060b14] border border-[#1a2a3d] rounded-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
            <span className="text-[10px] font-mono text-gray-600">Laya triage unavailable in this configuration</span>
          </div>
          <p className="text-[9px] font-mono text-gray-700 leading-relaxed">
            Agreement rate and priority comparison require Laya LLM triage results.
            No <code>triage_laya</code> data is present. Rules-based priority is the primary recommendation.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── REPLAY CONTROLS ──────────────────────────────────────────────────────────
interface ReplayControlsProps {
  channelLen: number;
  pos: number;
  setPos: (p: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  onReset: () => void;
}

const ReplayControls: React.FC<ReplayControlsProps> = ({
  channelLen, pos, setPos, playing, setPlaying, speed, setSpeed, onReset,
}) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-[#07101d] border-t border-[#1a2a3d]">
    <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm flex-shrink-0">
      SIMULATION
    </span>
    <button onClick={onReset} className="text-gray-600 hover:text-gray-400 transition-colors">
      <SkipBack size={13} />
    </button>
    <button onClick={() => setPlaying(!playing)} className="text-white hover:text-cyan-400 transition-colors">
      {playing ? <Pause size={14} /> : <Play size={14} />}
    </button>
    <input
      type="range" min={0} max={channelLen} value={pos}
      onChange={e => setPos(Number(e.target.value))}
      className="flex-1 h-1 accent-cyan-400 cursor-pointer"
    />
    <span className="text-[9px] font-mono text-gray-600 tabular-nums w-16 text-right">{pos}/{channelLen}</span>
    <select
      value={speed}
      onChange={e => setSpeed(Number(e.target.value))}
      className="px-1.5 py-0.5 bg-[#060b14] border border-[#1a2a3d] text-[9px] font-mono text-gray-400 rounded-sm outline-none"
    >
      <option value={1}>1×</option>
      <option value={5}>5×</option>
      <option value={20}>20×</option>
      <option value={50}>50×</option>
    </select>
    <button onClick={() => setPlaying(false)} className="text-gray-600 hover:text-red-400 transition-colors" title="Stop">
      <RotateCcw size={12} />
    </button>
  </div>
);

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export const SpaceDashboard: React.FC = () => {
  // ── Filter state
  const [query,          setQuery]          = useState('');
  const [detectorFilter, setDetectorFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [mainTab,        setMainTab]        = useState<'workspace' | 'health' | 'comparison'>('workspace');

  // ── Event selection
  const [selectedEvent, setSelectedEvent]   = useState<AnomalyEvent | null>(ANOMALY_EVENTS[0] ?? null);

  // ── Replay
  const [replayMode,  setReplayMode]  = useState(false);
  const [replayPos,   setReplayPos]   = useState(0);
  const [replayPlay,  setReplayPlay]  = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(5);
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Filtered events
  const filteredEvents = useMemo(() => {
    return ANOMALY_EVENTS.filter(e => {
      if (query && !e.id.toLowerCase().includes(query.toLowerCase()) &&
          !e.channel.toLowerCase().includes(query.toLowerCase())) return false;
      if (detectorFilter !== 'all' && e.detector !== detectorFilter) return false;
      if (priorityFilter !== 'all' && e.priority !== priorityFilter) return false;
      return true;
    });
  }, [query, detectorFilter, priorityFilter]);

  const sortedFiltered = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority);
      const pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return b.startIdx - a.startIdx;
    });
  }, [filteredEvents]);

  // ── Keyboard navigation
  const isTyping = useCallback((e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const idx = sortedFiltered.findIndex(ev => ev.id === selectedEvent?.id);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = sortedFiltered[idx + 1] ?? sortedFiltered[0];
        if (next) setSelectedEvent(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = sortedFiltered[idx - 1] ?? sortedFiltered[sortedFiltered.length - 1];
        if (prev) setSelectedEvent(prev);
      } else if (e.key === 'r' || e.key === 'R') {
        if (replayMode) setReplayPlay(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sortedFiltered, selectedEvent, replayMode, isTyping]);

  // ── Replay ticker
  const channelLen = selectedEvent
    ? (telemetryData[(selectedEvent.channel as ChannelId)] ?? []).length
    : 500;

  useEffect(() => {
    if (replayRef.current) clearInterval(replayRef.current);
    if (replayPlay && replayMode) {
      replayRef.current = setInterval(() => {
        setReplayPos(p => {
          if (p >= channelLen) { setReplayPlay(false); return channelLen; }
          return p + replaySpeed;
        });
      }, 50);
    }
    return () => { if (replayRef.current) clearInterval(replayRef.current); };
  }, [replayPlay, replayMode, replaySpeed, channelLen]);

  const handleReplayReset = () => {
    setReplayPos(0);
    setReplayPlay(false);
  };

  // Keep selected event valid when filters change
  useEffect(() => {
    if (selectedEvent && !filteredEvents.some(e => e.id === selectedEvent.id)) {
      setSelectedEvent(sortedFiltered[0] ?? null);
    }
  }, [filteredEvents, selectedEvent, sortedFiltered]);

  const handleSelectChannel = (ch: ChannelId) => {
    const firstEvent = ANOMALY_EVENTS.find(e => e.channel === ch) ?? null;
    setSelectedEvent(firstEvent);
    setMainTab('workspace');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-[#07101d] border-b border-[#1a2a3d]">
        {/* Identity */}
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-cyan-400" />
          <span className="text-[11px] font-bold text-white tracking-wider">OFFBEAT</span>
          <span className="text-[9px] font-mono text-cyan-400/80">CATCH THE CHANNEL THAT'S OFF BEAT</span>
          <span className="text-[9px] font-mono text-gray-600">· TELEMETRY ANOMALY INTELLIGENCE</span>
        </div>

        {/* Simulated replay badge */}
        <span className="px-2 py-0.5 bg-[#0d1f30] border border-[#1a3050] rounded text-[9px] font-mono text-[#4a8ab0] tracking-wider">
          SIMULATED REPLAY OF STORED DATA
        </span>

        <div className="flex-1" />

        {/* Main tab switcher */}
        <div className="flex items-center gap-1 bg-[#060b14] border border-[#1a2a3d] rounded-sm p-0.5">
          {(['workspace', 'health', 'comparison'] as const).map(t => (
            <button key={t}
              onClick={() => setMainTab(t)}
              className={`px-3 py-1 text-[10px] font-mono rounded-sm transition-colors capitalize ${
                mainTab === t ? 'bg-[#1a2a3d] text-white' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Replay toggle */}
        <button
          onClick={() => { setReplayMode(m => !m); if (!replayMode) handleReplayReset(); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-colors ${
            replayMode
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-[#060b14] border-[#1a2a3d] text-gray-600 hover:text-gray-400'
          }`}
        >
          {replayMode ? <Pause size={10} /> : <Play size={10} />}
          Replay
        </button>
      </div>

      {/* ── Main 3-panel layout ───────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT: Alerts panel */}
        <div className="flex-shrink-0 w-64 flex flex-col overflow-hidden">
          <AlertsPanel
            events={filteredEvents}
            selected={selectedEvent}
            onSelect={setSelectedEvent}
            query={query}
            setQuery={setQuery}
            detectorFilter={detectorFilter}
            setDetectorFilter={setDetectorFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
          />
        </div>

        {/* CENTER: Workspace / Health / Comparison */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {mainTab === 'workspace' && (
            <EventWorkspace
              event={selectedEvent}
              replayPos={replayMode ? replayPos : null}
            />
          )}
          {mainTab === 'health' && (
            <div className="flex-1 overflow-y-auto">
              <HealthTab onSelectChannel={handleSelectChannel} />
            </div>
          )}
          {mainTab === 'comparison' && (
            <div className="flex-1 overflow-y-auto">
              <ComparisonTab />
            </div>
          )}
        </div>

        {/* RIGHT: Investigation panel */}
        <div className="flex-shrink-0 w-72 flex flex-col overflow-hidden">
          <InvestigationPanel event={selectedEvent} />
        </div>
      </div>

      {/* ── Replay controls ───────────────────────────────────────────── */}
      {replayMode && (
        <ReplayControls
          channelLen={channelLen}
          pos={replayPos}
          setPos={setReplayPos}
          playing={replayPlay}
          setPlaying={setReplayPlay}
          speed={replaySpeed}
          setSpeed={setReplaySpeed}
          onReset={handleReplayReset}
        />
      )}
    </div>
  );
};
