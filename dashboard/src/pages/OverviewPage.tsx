import React from 'react';
import { ANOMALY_EVENTS, CHANNELS, CHANNEL_LABELS, EVALUATION, telemetryData } from '../data/telemetry';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Activity, CheckCircle2, Zap,
  TrendingUp, Layers, GitMerge, Clock
} from 'lucide-react';

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  urgent:       { label: 'Urgent Review',       color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30',   dot: 'bg-red-400'   },
  engineering:  { label: 'Engineering Review',  color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  routine:      { label: 'Routine Monitoring',  color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  dot: 'bg-blue-400'  },
  insufficient: { label: 'Insufficient Evidence', color: 'text-gray-500', bg: 'bg-white/5',     border: 'border-white/10',    dot: 'bg-gray-600'  },
};

// ─── Priority distribution bar ────────────────────────────────────────────────
const PriorityBar = () => {
  const counts = { urgent: 0, engineering: 0, routine: 0, insufficient: 0 };
  ANOMALY_EVENTS.forEach(e => counts[e.priority]++);
  const total = ANOMALY_EVENTS.length;

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden mb-3 gap-0.5">
        {(Object.entries(counts) as [keyof typeof counts, number][]).map(([k, v]) => (
          v > 0 && (
            <div
              key={k}
              className={`${k === 'urgent' ? 'bg-red-500' : k === 'engineering' ? 'bg-amber-500' : k === 'routine' ? 'bg-blue-500' : 'bg-gray-700'} transition-all`}
              style={{ width: `${(v / total) * 100}%` }}
            />
          )
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {(Object.entries(counts) as [keyof typeof counts, number][]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[k].dot}`} />
            <span className="text-[11px] font-mono text-gray-500">{PRIORITY_CONFIG[k].label}</span>
            <span className="text-[11px] font-mono text-white font-bold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Detector comparison row ──────────────────────────────────────────────────
const DetectorCard = ({ name, method, events, channels, note }: any) => (
  <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[13px] font-semibold text-white">{name}</h3>
      <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-mono tracking-wider rounded-sm">ACTIVE</span>
    </div>
    <p className="text-[11px] text-gray-500 font-mono mb-3 leading-relaxed">{method}</p>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[22px] font-bold text-white tabular-nums">{events}</div>
        <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Events detected</div>
      </div>
      <div>
        <div className="text-[22px] font-bold text-white tabular-nums">{channels}</div>
        <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Channels flagged</div>
      </div>
    </div>
    {note && <p className="mt-3 text-[10px] font-mono text-gray-600 border-t border-[#1a2a3d] pt-2">{note}</p>}
  </div>
);

// ─── KPI block ────────────────────────────────────────────────────────────────
const KPI = ({ value, label, sub, accent = false }: { value: string | number; label: string; sub?: string; accent?: boolean }) => (
  <div className="flex flex-col">
    <div className={`text-[36px] font-bold tabular-nums leading-none mb-1 ${accent ? 'text-cyan-400' : 'text-white'}`}>
      {value}
    </div>
    <div className="text-[12px] font-semibold text-gray-300">{label}</div>
    {sub && <div className="text-[11px] font-mono text-gray-600 mt-0.5">{sub}</div>}
  </div>
);

// ─── Recent events table ──────────────────────────────────────────────────────
const RecentEventsTable = ({ onSelect }: { onSelect: (id: string) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-[#1a2a3d]">
          {['Event ID', 'Channel', 'Detector', 'Duration', 'Error', 'Priority'].map(h => (
            <th key={h} className="text-left py-2 px-3 font-mono text-[10px] text-gray-600 uppercase tracking-wider font-normal first:pl-0">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ANOMALY_EVENTS.map((evt, i) => {
          const p = PRIORITY_CONFIG[evt.priority];
          return (
            <motion.tr
              key={evt.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(evt.id)}
              className="border-b border-[#0f1e2d] hover:bg-white/[0.025] cursor-pointer transition-colors group"
            >
              <td className="py-2.5 px-3 first:pl-0">
                <span className="font-mono text-cyan-400 text-[11px] group-hover:text-cyan-300">{evt.id}</span>
              </td>
              <td className="py-2.5 px-3">
                <span className="font-mono text-[11px] text-gray-300">{evt.channel}</span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                  evt.detector === 'telemanom'
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {evt.detector === 'telemanom' ? 'Telemanom' : 'Iso. Forest'}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className="font-mono text-[11px] text-gray-400">{evt.duration} samp.</span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`font-mono text-[11px] ${evt.channelError > 0.05 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {evt.channelError.toFixed(3)}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`flex items-center gap-1.5 ${p.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  <span className="text-[10px] font-mono">{p.label}</span>
                </span>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const OverviewPage: React.FC<{ onNavigateEvents: () => void }> = ({ onNavigateEvents }) => {
  const channelsCovered = new Set(ANOMALY_EVENTS.map(e => e.channel)).size;
  const engineeringCount = ANOMALY_EVENTS.filter(e => e.priority === 'engineering').length;
  const agreementPairs = EVALUATION.agreement.matched_pairs;

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1400px] mx-auto space-y-8">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white leading-tight mb-1.5 font-space-grotesk">
            Mission Overview
          </h1>
          <p className="text-[13px] text-gray-400 leading-relaxed">
            Telemetry health, detected deviations, and engineering review — NASA JPL SMAP & Curiosity Rover benchmark dataset.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-sm text-[10px] font-mono text-amber-400">
          <AlertTriangle size={11} />
          {engineeringCount} events require review
        </div>
      </div>

      {/* ── Top KPI strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1a2a3d]">
        {[
          { value: ANOMALY_EVENTS.length, label: 'Events detected', sub: 'Across all detectors' },
          { value: channelsCovered, label: 'Channels flagged', sub: `of ${CHANNELS.length} monitored` },
          { value: agreementPairs, label: 'Agreement pairs', sub: 'Multi-detector match', accent: true },
          { value: EVALUATION.leadTime.mean_samples, label: 'Mean lead time', sub: 'Samples before breach' },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#07101d] px-6 py-5">
            <KPI {...kpi} />
          </div>
        ))}
      </div>

      {/* ── Two column: distribution + detectors ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

        {/* Priority distribution */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-cyan-400" />
            <h2 className="text-[14px] font-semibold text-white">Event priority distribution</h2>
          </div>
          <p className="text-[11px] font-mono text-gray-600 mb-5">Based on rule-based triage applied to {ANOMALY_EVENTS.length} events</p>
          <PriorityBar />
        </div>

        {/* Detector summary */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitMerge size={14} className="text-cyan-400" />
            <h2 className="text-[14px] font-semibold text-white">Detector agreement</h2>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#060b14] border border-[#1a2a3d] rounded-sm mb-2">
            <div>
              <div className="text-[22px] font-bold text-white tabular-nums">{agreementPairs} / {CHANNELS.length}</div>
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Channels with multi-detector agreement</div>
            </div>
            <div className="ml-auto flex gap-2">
              <span className="px-1.5 py-0.5 bg-violet-500/15 text-violet-400 text-[9px] font-mono rounded-sm">Telemanom</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[9px] font-mono rounded-sm">Iso. Forest</span>
            </div>
          </div>
          <p className="text-[11px] font-mono text-gray-400 leading-relaxed">
            Multi-detector agreement between Telemanom LSTM and Isolation Forest across shared channels increases operational investigation confidence.
          </p>
        </div>
      </div>

      {/* ── Detector comparison ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-cyan-400" />
          <h2 className="text-[14px] font-semibold text-white">Detector comparison</h2>
          <span className="ml-auto text-[10px] font-mono text-emerald-400">NASA JPL Ground-Truth Labeled Benchmark · Hundman et al. (KDD 2018)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetectorCard
            name="Telemanom (LSTM)"
            method="LSTM sequence-to-sequence reconstruction. Dynamic per-channel thresholds based on smoothed error distributions."
            events={EVALUATION.telemanom.events_detected}
            channels={EVALUATION.telemanom.channels_covered}
            note={`NASA JPL Benchmark F₁: ${EVALUATION.telemanom.f1} (${(EVALUATION.telemanom.precision * 100).toFixed(1)}% precision / ${(EVALUATION.telemanom.recall * 100).toFixed(1)}% recall) on SMAP/MSL ground truth.`}
          />
          <DetectorCard
            name="Isolation Forest"
            method="Ensemble-based anomaly isolation. Each tree randomly partitions the feature space; anomalies are isolated faster."
            events={EVALUATION.isolation_forest.events_detected}
            channels={EVALUATION.isolation_forest.channels_covered}
            note={EVALUATION.isolation_forest.note}
          />
        </div>
      </div>

      {/* ── Recent events table ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-cyan-400" />
          <h2 className="text-[14px] font-semibold text-white">All detected events</h2>
          <button
            onClick={onNavigateEvents}
            className="ml-auto text-[11px] font-mono text-cyan-500 hover:text-cyan-300 transition-colors"
          >
            Open event explorer →
          </button>
        </div>
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm px-4 py-2">
          <RecentEventsTable onSelect={onNavigateEvents} />
        </div>
      </div>

    </div>
  );
};
