import React, { useState, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  telemetryData, getDetectorError, CHANNELS, CHANNEL_LABELS,
  CHANNEL_UNITS, TELEMANOM_THRESHOLD, ANOMALY_EVENTS, type ChannelId
} from '../data/telemetry';
import { ChevronDown, AlertTriangle } from 'lucide-react';

// ─── Custom Recharts tooltip ──────────────────────────────────────────────────
const TelTooltip = ({ active, payload, label, channel, unit, events }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const matchingEvent = events?.find((e: any) => label >= e.startIdx && label <= e.endIdx);

  return (
    <div className="bg-[#07101d] border border-[#1a3050] rounded-sm px-3 py-2.5 shadow-xl text-[11px] font-mono min-w-[160px]">
      <div className="flex justify-between gap-4 mb-1.5">
        <span className="text-gray-500">IDX</span>
        <span className="text-white tabular-nums">{label}</span>
      </div>
      <div className="flex justify-between gap-4 mb-1.5">
        <span className="text-gray-500">{channel}</span>
        <span className="text-cyan-300 tabular-nums font-bold">{typeof val === 'number' ? val.toFixed(4) : '–'} {unit}</span>
      </div>
      {matchingEvent && (
        <div className="mt-2 pt-2 border-t border-[#1a3050]">
          <div className="text-amber-400 text-[10px] flex items-center gap-1">
            <AlertTriangle size={9} />
            {matchingEvent.id} · {matchingEvent.detector === 'telemanom' ? 'Telemanom' : 'Iso. Forest'}
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#07101d] border border-[#1a3050] rounded-sm px-3 py-2 shadow-xl text-[11px] font-mono">
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-gray-500">IDX</span>
        <span className="text-white tabular-nums">{label}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Error</span>
        <span className="text-violet-300 tabular-nums">{payload[0]?.value?.toFixed(5)}</span>
      </div>
    </div>
  );
};

// ─── Channel selector ─────────────────────────────────────────────────────────
const ChannelSelect = ({ value, onChange }: { value: ChannelId; onChange: (c: ChannelId) => void }) => {
  const [open, setOpen] = useState(false);
  const eventsForChannel = (c: ChannelId) => ANOMALY_EVENTS.filter(e => e.channel === c).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-[#0d1f30] border border-[#1a3050] hover:border-[#2a5070] text-[12px] font-mono text-gray-200 transition-colors rounded-sm min-w-[200px]"
      >
        <span className="text-cyan-400">{value}</span>
        <span className="text-gray-500">—</span>
        <span className="flex-1 text-left">{CHANNEL_LABELS[value]}</span>
        <ChevronDown size={12} className="text-gray-500" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[#0d1f30] border border-[#1a3050] rounded-sm z-30 shadow-xl py-1">
          {CHANNELS.map(c => {
            const count = eventsForChannel(c);
            return (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono hover:bg-white/5 text-left transition-colors ${c === value ? 'text-cyan-400' : 'text-gray-300'}`}
              >
                <span className="w-8">{c}</span>
                <span className="flex-1 text-gray-500">{CHANNEL_LABELS[c]}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded-sm">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const TelemetryPage: React.FC = () => {
  const [channel, setChannel] = useState<ChannelId>('T-1B');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const series = telemetryData[channel];
  const errorSeries = useMemo(() => getDetectorError(channel), [channel]);
  const threshold = TELEMANOM_THRESHOLD[channel];
  const channelEvents = ANOMALY_EVENTS.filter(e => e.channel === channel);
  const unit = CHANNEL_UNITS[channel];

  // Build reference areas for anomaly intervals
  const refAreas = channelEvents.map(e => ({
    x1: e.startIdx,
    x2: e.endIdx,
    id: e.id,
    detector: e.detector,
  }));

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1400px] mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[28px] font-bold text-white leading-tight mb-1.5 font-space-grotesk">
          Telemetry Explorer
        </h1>
        <p className="text-[13px] text-gray-500">
          Inspect per-channel time series, reconstruction error, and detected anomaly intervals.
        </p>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <ChannelSelect value={channel} onChange={c => { setChannel(c); setSelectedEvent(null); }} />
        {channelEvents.length > 0 && (
          <div className="flex items-center gap-2">
            {channelEvents.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEvent(selectedEvent === e.id ? null : e.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono rounded-sm border transition-all ${
                  selectedEvent === e.id
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:border-amber-500/40'
                }`}
              >
                <AlertTriangle size={9} />
                {e.id}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-[11px] font-mono text-gray-600">
          {series.length} samples · {CHANNEL_LABELS[channel]} · {unit}
        </span>
      </div>

      {/* ── Primary telemetry chart ──────────────────────────────────── */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono font-bold text-cyan-400">{channel}</span>
              <span className="text-[12px] font-semibold text-white">{CHANNEL_LABELS[channel]}</span>
              {channelEvents.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-mono rounded-sm">
                  {channelEvents.length} anomaly detected
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-gray-600 mt-0.5">Observed signal · Units: {unit} · Timestep index (not real timestamps)</p>
          </div>
          {/* Legend */}
          <div className="ml-auto flex items-center gap-4 text-[10px] font-mono text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-5 h-px bg-cyan-400 inline-block" /> observed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-amber-500/20 inline-block border border-amber-500/30 rounded-sm" /> anomaly interval</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="telFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2,6" stroke="#0f1e2d" vertical={false} />
            <XAxis
              dataKey="idx"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' }}
              tickLine={false}
              axisLine={{ stroke: '#1a2a3d' }}
              interval={49}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={v => `${v.toFixed(1)}`}
            />
            <Tooltip
              content={<TelTooltip channel={channel} unit={unit} events={channelEvents} />}
              cursor={{ stroke: '#2a5070', strokeWidth: 1, strokeDasharray: '3,3' }}
            />
            {/* Anomaly reference areas */}
            {refAreas.map(ra => (
              <ReferenceArea
                key={ra.id}
                x1={ra.x1} x2={ra.x2}
                fill={selectedEvent === ra.id ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.08)'}
                stroke={selectedEvent === ra.id ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.2)'}
                strokeWidth={1}
              />
            ))}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill="url(#telFill)"
              dot={false}
              activeDot={{ r: 3, fill: '#22d3ee', stroke: '#07101d', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Detector reconstruction error ────────────────────────────── */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-white">Reconstruction Error</span>
              <span className="text-[10px] font-mono text-gray-600">Telemanom LSTM · smoothed per-channel</span>
            </div>
            {threshold !== null && (
              <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                Dynamic threshold: <span className="text-violet-400">{threshold}</span> · Values above = flagged as anomalous
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4 text-[10px] font-mono text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-5 h-px bg-violet-400 inline-block" /> error</span>
            {threshold !== null && <span className="flex items-center gap-1.5"><span className="w-5 h-px border-t border-red-500 border-dashed inline-block" /> threshold</span>}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={errorSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2,6" stroke="#0f1e2d" vertical={false} />
            <XAxis
              dataKey="idx"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' }}
              tickLine={false}
              axisLine={{ stroke: '#1a2a3d' }}
              interval={49}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#3a5a7a' }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={v => v.toFixed(3)}
            />
            <Tooltip content={<ErrorTooltip />} cursor={{ stroke: '#2a5070', strokeWidth: 1 }} />
            {threshold !== null && (
              <ReferenceLine y={threshold} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
            )}
            {refAreas.map(ra => (
              <ReferenceArea key={ra.id} x1={ra.x1} x2={ra.x2} fill="rgba(245,158,11,0.06)" />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#a78bfa', stroke: '#07101d', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Events for this channel ──────────────────────────────────── */}
      {channelEvents.length > 0 && (
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-5">
          <h3 className="text-[13px] font-semibold text-white mb-4">
            Detected events on {channel}
          </h3>
          <div className="space-y-3">
            {channelEvents.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEvent(selectedEvent === e.id ? null : e.id)}
                className={`w-full text-left p-4 rounded-sm border transition-all ${
                  selectedEvent === e.id
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-[#060b14] border-[#1a2a3d] hover:border-[#2a4a6a]'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-mono text-[12px] text-cyan-400">{e.id}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                    e.detector === 'telemanom' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {e.detector === 'telemanom' ? 'Telemanom' : 'Isolation Forest'}
                  </span>
                  {e.matchedEventId && (
                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                      agrees w/ {e.matchedEventId}
                    </span>
                  )}
                </div>
                <div className="flex gap-6 text-[11px] font-mono text-gray-500">
                  <span>Start: <span className="text-white">{e.startIdx}</span></span>
                  <span>End: <span className="text-white">{e.endIdx}</span></span>
                  <span>Duration: <span className="text-white">{e.duration} samples</span></span>
                  <span>Error: <span className="text-amber-400">{e.channelError.toFixed(3)}</span></span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
