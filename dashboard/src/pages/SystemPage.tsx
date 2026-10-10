import React, { useEffect, useState } from 'react';
import {
  Info, Cpu, Database, CheckCircle2, RefreshCw
} from 'lucide-react';
import { apiService, type HealthResponse } from '../data/apiService';

export const SystemPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse>({ status: 'offline', available_channels: [] });
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    const h = await apiService.getHealth();
    setHealth(h);
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060b14] overflow-y-auto p-8 text-gray-200">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[#1a2a3d] pb-6">
          <div className="flex items-center gap-3">
            <Info className="text-cyan-400" size={22} />
            <div>
              <h1 className="text-xl font-bold tracking-wider text-white uppercase font-inter">
                System & Pipeline Architecture
              </h1>
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                ISRO Problem SPACE-03 · Dual Detector Pipeline · Rule Triage & RAG Grounding
              </p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0a1829] border border-[#1a2a3d] text-xs font-mono text-cyan-400 hover:text-cyan-300"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh Probe
          </button>
        </div>

        {/* ── Status Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-[#07101d] border border-[#1a2a3d] rounded-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                FastAPI Service
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  health.status === 'ok'
                    ? 'bg-green-400 animate-pulse'
                    : health.status === 'models_unavailable'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {health.status === 'ok'
                ? 'ONLINE (MODELS READY)'
                : health.status === 'models_unavailable'
                ? 'STANDBY (API ONLINE)'
                : 'LOCAL MODE'}
            </div>
            <p className="text-[11px] text-gray-500 font-mono mt-2">
              FastAPI backend running on 127.0.0.1:8000 via Uvicorn.
            </p>
          </div>

          <div className="p-5 bg-[#07101d] border border-[#1a2a3d] rounded-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                Dual Detectors
              </span>
              <Cpu size={14} className="text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">LSTM + ISO-FOREST</div>
            <p className="text-[11px] text-gray-500 font-mono mt-2">
              Telemanom (LSTM prediction error) & Sklearn Isolation Forest baseline.
            </p>
          </div>

          <div className="p-5 bg-[#07101d] border border-[#1a2a3d] rounded-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                RAG Engine
              </span>
              <Database size={14} className="text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">GROUNDED PASSAGES</div>
            <p className="text-[11px] text-gray-500 font-mono mt-2">
              TF-IDF Cosine semantic index across Telemanom research and mission glossary.
            </p>
          </div>
        </div>

        {/* ── Architecture Diagram ───────────────────────────────────── */}
        <div className="p-6 bg-[#07101d] border border-[#1a2a3d] rounded-sm space-y-4">
          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
            Data & Execution Pipeline Flow
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs font-mono">
            <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
              <div className="text-cyan-400 font-bold mb-1">1. Telemetry Data</div>
              <div className="text-[10px] text-gray-400">NASA SMAP/MSL (82 channels) & ESA Mission 1</div>
            </div>

            <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
              <div className="text-cyan-400 font-bold mb-1">2. Dual Detectors</div>
              <div className="text-[10px] text-gray-400">LSTM Error Thresholding & Isolation Forest</div>
            </div>

            <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
              <div className="text-cyan-400 font-bold mb-1">3. Event Builder</div>
              <div className="text-[10px] text-gray-400">Uniform anomaly intervals & agreement matching</div>
            </div>

            <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
              <div className="text-cyan-400 font-bold mb-1">4. Rule Triage</div>
              <div className="text-[10px] text-gray-400">Urgent, Engineering, Routine, Insufficient</div>
            </div>

            <div className="p-4 bg-[#0a1829] border border-[#1a2a3d] rounded-sm">
              <div className="text-cyan-400 font-bold mb-1">5. Mission Control</div>
              <div className="text-[10px] text-gray-400">Offbeat UI + Grounded Evidence Assistant</div>
            </div>
          </div>
        </div>

        {/* ── Dataset Coverage & Limitations ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-[#07101d] border border-[#1a2a3d] rounded-sm space-y-3">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">
              Dataset Statistics
            </h3>
            <ul className="space-y-2 text-xs font-mono text-gray-300">
              <li className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-500">NASA SMAP Channels</span>
                <span>55 channels (Power, Thermal, Rad)</span>
              </li>
              <li className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-500">NASA MSL Curiosity Channels</span>
                <span>27 rover telemetry streams</span>
              </li>
              <li className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-500">Labeled Anomaly Sequences</span>
                <span>105 sequences (62 point, 43 contextual)</span>
              </li>
              <li className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-500">Evaluated Telemetry Points</span>
                <span>496,444 samples</span>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-[#07101d] border border-[#1a2a3d] rounded-sm space-y-3">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">
              Aerospace AI Disclaimers & Ethics
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Anomaly detection models output statistical outlier scores and deviation bounds. They do not constitute autonomous mechanical diagnosis, fault isolation, or replacement for qualified flight controller intervention.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400/80 pt-2 border-t border-white/5">
              <CheckCircle2 size={13} />
              <span>Complies with SPACE-03 Section 11 Claim Verifiability Standards</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPage;
