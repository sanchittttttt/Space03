import React from 'react';
import { EVALUATION, ANOMALY_EVENTS } from '../data/telemetry';
import { CheckCircle2, ShieldCheck, Zap, Activity, ExternalLink } from 'lucide-react';

// ─── Metric block ─────────────────────────────────────────────────────────────
const Metric = ({ label, value, note, source, unavailable = false }: {
  label: string; value?: string | number; note?: string; source?: string; unavailable?: boolean;
}) => (
  <div className="py-4 border-b border-[#1a2a3d] last:border-0">
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-gray-400">{label}</span>
      {unavailable ? (
        <span className="text-[12px] font-mono text-gray-600 italic">Unavailable</span>
      ) : (
        <span className="text-[18px] font-bold text-white tabular-nums">{value}</span>
      )}
    </div>
    {note && <p className="text-[10px] font-mono text-gray-500 mt-1 leading-relaxed">{note}</p>}
    {source && <p className="text-[10px] font-mono text-cyan-600 mt-0.5">{source}</p>}
  </div>
);

// ─── Source label ─────────────────────────────────────────────────────────────
const SourceLabel = ({ text, type }: { text: string; type: 'paper' | 'groundtruth' | 'calibrated' }) => {
  const cfg = {
    paper:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    groundtruth: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    calibrated:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  return (
    <span className={`px-2 py-0.5 text-[9px] font-mono border rounded-sm tracking-wider ${cfg[type]}`}>
      {text}
    </span>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export const EvaluationPage: React.FC = () => {
  const urgentCount       = ANOMALY_EVENTS.filter(e => e.priority === 'urgent').length;
  const engineeringCount  = ANOMALY_EVENTS.filter(e => e.priority === 'engineering').length;
  const routineCount      = ANOMALY_EVENTS.filter(e => e.priority === 'routine').length;
  const insufficientCount = ANOMALY_EVENTS.filter(e => e.priority === 'insufficient').length;

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1100px] mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-white leading-tight mb-1.5 font-space-grotesk">Evaluation</h1>
        <p className="text-[13px] text-gray-400 max-w-2xl leading-relaxed">
          Ground-truth performance metrics and event-level evaluation summaries across NASA JPL SMAP (Soil Moisture Active Passive) satellite and Curiosity Mars Rover (MSL) telemetry streams.
        </p>
      </div>

      {/* Ground Truth Validation Banner */}
      <div className="flex items-start gap-3.5 p-4 bg-emerald-500/[0.06] border border-emerald-500/25 rounded-sm">
        <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[12px] font-semibold text-emerald-300">NASA JPL Ground-Truth Labeled Benchmark</p>
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded">
              VERIFIED GROUND TRUTH
            </span>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed">
            Evaluated against 105 expert-labeled anomaly sequences across 82 unique spacecraft telemetry channels (496,444 evaluated time steps) from Hundman et al. (NASA JPL, KDD 2018). Ground truth test set includes verified point anomalies (62) and contextual deviations (43).
          </p>
        </div>
      </div>

      {/* Two-column grid: Telemanom vs Isolation Forest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Telemanom */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Telemanom (LSTM)</h2>
              <p className="text-[11px] font-mono text-gray-500 mt-0.5">Sequence-to-sequence prediction & dynamic thresholding</p>
            </div>
            <SourceLabel text="NASA JPL · KDD 2018" type="groundtruth" />
          </div>

          {/* Mission Breakdown Grid */}
          <div className="mb-5 pb-5 border-b border-[#1a2a3d]">
            <p className="text-[11px] font-mono text-gray-500 mb-3 uppercase tracking-wider">Ground-Truth Performance by Spacecraft</p>
            <div className="space-y-2">
              {/* SMAP */}
              <div className="bg-[#060b14] p-3 border border-[#1a2a3d]/80 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">SMAP Satellite (55 channels)</span>
                  <span className="text-[10px] font-mono text-gray-500">69 labeled sequences</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[18px] font-bold text-white tabular-nums">{(EVALUATION.smap.precision * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">Precision</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-white tabular-nums">{(EVALUATION.smap.recall * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">Recall</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-cyan-400 tabular-nums">{EVALUATION.smap.f1.toFixed(3)}</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">F₁ Score</div>
                  </div>
                </div>
              </div>

              {/* Curiosity MSL */}
              <div className="bg-[#060b14] p-3 border border-[#1a2a3d]/80 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">Curiosity Rover MSL (27 channels)</span>
                  <span className="text-[10px] font-mono text-gray-500">36 labeled sequences</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[18px] font-bold text-white tabular-nums">{(EVALUATION.msl.precision * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">Precision</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-white tabular-nums">{(EVALUATION.msl.recall * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">Recall</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-amber-400 tabular-nums">{EVALUATION.msl.f1.toFixed(3)}</div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase">F₁ Score</div>
                  </div>
                </div>
              </div>

              {/* Overall Combined */}
              <div className="bg-[#0e2137] p-3 border border-cyan-500/30 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-white font-semibold">Overall Combined Benchmark</span>
                  <span className="text-[10px] font-mono text-cyan-400">82 channels · 496,444 steps</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[20px] font-bold text-cyan-300 tabular-nums">{(EVALUATION.telemanom.precision * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase">Precision</div>
                  </div>
                  <div>
                    <div className="text-[20px] font-bold text-cyan-300 tabular-nums">{(EVALUATION.telemanom.recall * 100).toFixed(1)}%</div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase">Recall</div>
                  </div>
                  <div>
                    <div className="text-[20px] font-bold text-emerald-400 tabular-nums">{EVALUATION.telemanom.f1.toFixed(3)}</div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase">F₁ Score</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] font-mono text-gray-500 mb-2 uppercase tracking-wider">Mission Detection Statistics</p>
          <Metric label="Detected anomaly sequences" value={EVALUATION.telemanom.events_detected} note="Total detected anomaly sequence intervals across test runs." />
          <Metric label="Spacecraft channels covered" value={EVALUATION.telemanom.channels_covered} note="SMAP and MSL channels with validated LSTM models." />
          <Metric label="F₀.₅ score (high precision focus)" value={EVALUATION.telemanom.f05.toFixed(2)} note="Weights precision higher than recall to minimize false alarms in mission operations." />
        </div>

        {/* Isolation Forest */}
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Isolation Forest</h2>
                <p className="text-[11px] font-mono text-gray-500 mt-0.5">Rolling window statistical feature baseline</p>
              </div>
              <SourceLabel text="CALIBRATED BASELINE" type="calibrated" />
            </div>

            <div className="p-3 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-sm mb-5 text-[11px] font-mono text-indigo-300 leading-relaxed">
              Trained on rolling statistical features (mean, std, min, max, slope) with dynamic contamination thresholds calibrated per channel timeline.
            </div>

            <Metric label="Precision" value={`${(EVALUATION.isolation_forest.precision * 100).toFixed(1)}%`} note="Calibrated against ground truth labeled windows." />
            <Metric label="Recall" value={`${(EVALUATION.isolation_forest.recall * 100).toFixed(1)}%`} note="Detects point spikes and abrupt operational shifts." />
            <Metric label="F₁ score" value={EVALUATION.isolation_forest.f1.toFixed(3)} note="Balanced harmonic mean across evaluated telemetry streams." />
            <Metric label="Flagged anomaly intervals" value={EVALUATION.isolation_forest.events_detected} note="Total anomalous regions isolated across channels." />
            <Metric label="Channels evaluated" value={EVALUATION.isolation_forest.channels_covered} note="Telemetry channels scored with Isolation Forest models." />
            <Metric
              label="Feature window sizes"
              value="8 – 50 samples"
              note="Optimized rolling feature windows for high-frequency and low-frequency telemetry."
            />
          </div>

          <div className="pt-4 border-t border-[#1a2a3d] mt-4">
            <p className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              Models stored in artifacts/isolation_forest/models/
            </p>
          </div>
        </div>
      </div>

      {/* Agreement & lead time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold text-white">Detector Agreement</h2>
            <SourceLabel text="MULTI-DETECTOR CONSENSUS" type="groundtruth" />
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#1a2a3d] mb-4">
            <div className="bg-[#060b14] px-4 py-3">
              <div className="text-[28px] font-bold text-cyan-400 tabular-nums">{EVALUATION.agreement.matched_pairs}</div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Matched Interval Pairs</div>
            </div>
            <div className="bg-[#060b14] px-4 py-3">
              <div className="text-[28px] font-bold text-white tabular-nums">
                {EVALUATION.agreement.channels_with_agreement}/{EVALUATION.agreement.total_channels}
              </div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Agreed Channels</div>
            </div>
          </div>
          <p className="text-[11px] font-mono text-gray-400 leading-relaxed">
            Events are matched when Telemanom LSTM and Isolation Forest flag overlapping intervals on the same channel. Dual-detector agreement triggers high-confidence escalation to Engineering and Urgent review.
          </p>
        </div>

        <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold text-white">Early Detection Lead Time</h2>
            <SourceLabel text="NASA GROUND TRUTH" type="groundtruth" />
          </div>
          <div className="flex items-baseline gap-4 mb-2">
            <div className="text-[40px] font-bold text-emerald-400 tabular-nums">
              +{EVALUATION.leadTime.mean_samples}
              <span className="text-[15px] font-normal text-gray-400 ml-2">samples</span>
            </div>
            <div className="text-[18px] font-bold text-white tabular-nums">
              {EVALUATION.leadTime.positive_rate}% <span className="text-[11px] font-normal text-gray-400">early detection rate</span>
            </div>
          </div>
          <p className="text-[11px] font-mono text-gray-400 leading-relaxed mt-3">
            Computed from lead_times.csv across 88 verified channel runs. Over 62.5% of anomalies were flagged prior to the expert-labeled failure onset index, giving operators crucial advance warning.
          </p>
        </div>
      </div>

      {/* Event-level summary */}
      <div className="bg-[#0a1829] border border-[#1a2a3d] rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-white">Event-Level Triage Summary</h2>
          <span className="text-[11px] font-mono text-gray-500">SPACE-03 Rule-Based Protocol</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[#1a2a3d] mb-4">
          {[
            { label: 'Urgent review', value: urgentCount, color: 'text-rose-400' },
            { label: 'Engineering review', value: engineeringCount, color: 'text-amber-400' },
            { label: 'Routine monitoring', value: routineCount, color: 'text-cyan-400' },
            { label: 'Insufficient evidence', value: insufficientCount, color: 'text-gray-500' },
            { label: 'Total active events', value: ANOMALY_EVENTS.length, color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#060b14] px-4 py-3">
              <div className={`text-[24px] font-bold tabular-nums ${color}`}>{value}</div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider leading-tight mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-mono text-gray-500">
          Triage priorities are assigned deterministically from detector agreement, anomaly duration, and channel error percentiles according to the mission handoff specification.
        </p>
      </div>
    </div>
  );
};
