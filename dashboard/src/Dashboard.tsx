import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Activity, BarChart2,
  Shield, TrendingUp, Clock, Satellite, Cpu, Radio, Thermometer,
  ChevronDown, Filter
} from 'lucide-react';

// ─── Micro-chart via SVG path ──────────────────────────────────────────────────
const SparkLine = ({
  data, color = '#22d3ee', anomalyFrom
}: { data: number[]; color?: string; anomalyFrom?: number }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100, h = 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const anomalyPts = anomalyFrom !== undefined
    ? data.slice(anomalyFrom).map((v, i) =>
        `${((anomalyFrom + i) / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
      ).join(' ')
    : null;

  return (
    <svg className="w-full h-32" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {/* Threshold line */}
      {anomalyFrom !== undefined && (
        <line x1="0" y1="30" x2="100" y2="30" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
      )}
      {/* Fill */}
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill={`${color}15`}
        stroke="none"
      />
      {/* Nominal line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {/* Anomaly highlight */}
      {anomalyPts && (
        <polyline points={anomalyPts} fill="none" stroke="#ef4444" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
};

// ─── Stat card ─────────────────────────────────────────────────────────────────
const Stat = ({ label, value, unit, delta, color = 'white' }: any) => (
  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-sm">
    <p className="text-[10px] font-mono text-gray-600 tracking-widest uppercase mb-2">{label}</p>
    <div className="flex items-end gap-1">
      <span className={`text-3xl font-extrabold leading-none ${color === 'red' ? 'text-red-400' : color === 'cyan' ? 'text-cyan-400' : 'text-white'}`}>
        {value}
      </span>
      {unit && <span className="text-gray-600 text-sm font-mono mb-0.5">{unit}</span>}
    </div>
    {delta && (
      <p className={`text-[10px] font-mono mt-1.5 ${delta.startsWith('+') ? 'text-red-400' : 'text-green-400'}`}>{delta}</p>
    )}
  </div>
);

// ─── Detector agreement badge ──────────────────────────────────────────────────
const DetectorRow = ({ name, result, confidence, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex items-center gap-3 py-3 border-b border-white/5"
  >
    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${result === 'ANOMALY' ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'bg-green-400'}`} />
    <span className="text-[11px] font-mono text-gray-400 flex-1 tracking-wider">{name}</span>
    <span className={`text-[11px] font-bold font-mono ${result === 'ANOMALY' ? 'text-red-400' : 'text-green-400'}`}>{result}</span>
    <span className="text-[11px] font-mono text-gray-600 w-12 text-right">{confidence}</span>
  </motion.div>
);

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export const Dashboard = ({ onBack }: { onBack: () => void }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Generate mock telemetry series
  const nominalSeries = Array.from({ length: 40 }, (_, i) => 272.5 + Math.sin(i * 0.4) * 0.8 + Math.random() * 0.3);
  const anomalySeries = [
    ...nominalSeries.slice(0, 28),
    ...Array.from({ length: 12 }, (_, i) => 273.2 + i * 0.55 + Math.random() * 0.4)
  ];
  const voltageSeries = Array.from({ length: 40 }, (_, i) => 28.3 + Math.sin(i * 0.3 + 1) * 0.4 + Math.random() * 0.15);

  const now = new Date();

  return (
    <div className="min-h-screen bg-[#01020a] text-gray-200" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center gap-4 px-8 py-4 bg-[#01020a]/90 backdrop-blur-xl border-b border-white/5">
        <button onClick={onBack} className="p-2 rounded-sm text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Satellite size={16} className="text-cyan-400" strokeWidth={1.5} />
          <span className="text-sm font-bold tracking-widest text-white">SPACE-03</span>
        </div>
        <span className="text-gray-700 font-mono text-xs">/ Mission Control</span>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            UPLINK ACTIVE
          </div>
          <div className="hidden md:block text-[10px] font-mono text-gray-600">
            {now.toUTCString().slice(0, -7)} UTC
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-sm text-[10px] font-mono text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            1 ACTIVE ANOMALY
          </div>
        </div>
      </header>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="p-6 md:p-8 grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-6">

        {/* ── Left sidebar ──────────────────────────────────────────── */}
        <aside className="space-y-5">

          {/* Triage */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={13} className="text-cyan-400" />
              <h2 className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">Rule-Based Triage</h2>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative p-4 bg-red-500/[0.06] border border-red-500/20 rounded-sm mb-3 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-0.5 h-full bg-red-500" />
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono font-bold text-red-400 tracking-widest">CRITICAL</span>
                <span className="text-[9px] font-mono text-gray-600">T-04:12:00</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
                Thermal radiator loop B temperature exceeds 3σ threshold. Telemanom + IsoForest both detect.
              </p>
              <div className="flex gap-2">
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-mono rounded-sm">THERMAL</span>
                <span className="px-1.5 py-0.5 bg-white/5 text-gray-500 text-[9px] font-mono rounded-sm">MULTI-DETECTOR</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 bg-white/[0.02] border border-white/5 rounded-sm opacity-60"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono font-bold text-gray-500 tracking-widest">LOW</span>
                <span className="text-[9px] font-mono text-gray-600">T-12:45:00</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">Minor S-band downlink jitter. Within safe margins.</p>
            </motion.div>
          </section>

          {/* Detector agreement */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={13} className="text-cyan-400" />
              <h2 className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">Detector Agreement</h2>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-sm px-4">
              <DetectorRow name="Telemanom (LSTM)" result="ANOMALY" confidence="98.2%" delay={0.1} />
              <DetectorRow name="Isolation Forest" result="ANOMALY" confidence="87.4%" delay={0.2} />
              <DetectorRow name="ARIMA Baseline" result="NOMINAL" confidence="11.5%" delay={0.3} />
              <DetectorRow name="Rule Threshold" result="ANOMALY" confidence="100%" delay={0.4} />
            </div>
          </section>

          {/* Evaluation */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={13} className="text-cyan-400" />
              <h2 className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">Evaluation</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="TPR" value="94.2" unit="%" color="cyan" />
              <Stat label="FPR" value="3.1" unit="%" />
              <Stat label="Lead Time" value="4h 12m" />
              <Stat label="F1 Score" value="0.91" color="cyan" />
            </div>
          </section>
        </aside>

        {/* ── Main content ───────────────────────────────────────────── */}
        <main className="space-y-6 min-w-0">

          {/* Anomaly highlight banner */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-4 p-5 bg-red-500/[0.07] border border-red-500/25 rounded-sm"
          >
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-red-400 mb-1">Thermal Anomaly Detected — CHANNEL A: RADIATOR TEMP (LOOP B)</h3>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Telemanom LSTM model flagged a sustained upward deviation at T-minus 12 minutes. Pattern inconsistent with eclipse heating cycle.
                Isolation Forest corroborates at 87.4% confidence. Rule-based threshold breach confirmed. Recommend engineer review.
              </p>
            </div>
            <span className="flex-shrink-0 text-[10px] font-mono text-red-500 border border-red-500/30 px-2 py-1">OPEN</span>
          </motion.div>

          {/* Telemetry chart: Thermal */}
          <section className="bg-white/[0.02] border border-white/5 rounded-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer size={14} className="text-red-400" />
                  <h3 className="text-[11px] font-mono tracking-widest text-white uppercase">Channel A · Radiator Temperature</h3>
                </div>
                <p className="text-[10px] font-mono text-gray-600">Kelvin · 40-point rolling window · Anomaly flagged at T-28</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
                  <span className="w-4 h-px bg-cyan-400 inline-block" /> nominal
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
                  <span className="w-4 h-px bg-red-400 inline-block" /> anomaly
                </span>
              </div>
            </div>
            <SparkLine data={anomalySeries} color="#22d3ee" anomalyFrom={28} />
            <div className="flex justify-between text-[9px] font-mono text-gray-700 mt-1">
              <span>T-39m</span><span>T-28m</span><span>T-now</span>
            </div>
          </section>

          {/* Telemetry chart: Voltage */}
          <section className="bg-white/[0.02] border border-white/5 rounded-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-green-400" />
                  <h3 className="text-[11px] font-mono tracking-widest text-white uppercase">Channel B · Bus Voltage</h3>
                </div>
                <p className="text-[10px] font-mono text-gray-600">Volts · Nominal operating range: 27.5–29.0 V</p>
              </div>
              <CheckCircle2 size={16} className="text-green-400" />
            </div>
            <SparkLine data={voltageSeries} color="#4ade80" />
            <div className="flex justify-between text-[9px] font-mono text-gray-700 mt-1">
              <span>T-39m</span><span>T-now</span>
            </div>
          </section>

        </main>

        {/* ── Right sidebar ──────────────────────────────────────────── */}
        <aside className="space-y-5">

          {/* Orbital parameters */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Satellite size={13} className="text-cyan-400" strokeWidth={1.5} />
              <h2 className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">Orbital Parameters</h2>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-sm divide-y divide-white/5">
              {[
                ['Altitude', '582.4 km'],
                ['Inclination', '97.41°'],
                ['RAAN', '214.7°'],
                ['Period', '96.4 min'],
                ['Eccentricity', '0.00103'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2.5">
                  <span className="text-[10px] font-mono text-gray-600">{k}</span>
                  <span className="text-[10px] font-mono text-white">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Quick telemetry snapshot */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-cyan-400" />
              <h2 className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">Live Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Rad. Temp" value={(273.2 + Math.sin(tick * 0.05) * 3.1).toFixed(1)} unit="K" delta="+2.1σ" color="red" />
              <Stat label="Bus V" value={(28.3 + Math.sin(tick * 0.08 + 1) * 0.4).toFixed(2)} unit="V" />
              <Stat label="Link S/N" value={(18.6 + Math.sin(tick * 0.12 + 2) * 1.2).toFixed(1)} unit="dB" />
              <Stat label="SoC" value="94" unit="%" color="cyan" />
            </div>
          </section>

          {/* Lead time info */}
          <section className="p-4 bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={13} className="text-cyan-400" />
              <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">Lead Time</span>
            </div>
            <p className="text-2xl font-extrabold text-white mb-1">4h 12m</p>
            <p className="text-[10px] text-gray-500 leading-relaxed font-mono">
              Average early warning before threshold breach across all anomaly events in evaluation dataset.
            </p>
          </section>

        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
