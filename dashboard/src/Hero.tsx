import React, { useState, useEffect, useRef } from 'react';
import Scene from './Scene';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Activity, ShieldAlert, Zap, ChevronRight, X, Satellite, Cpu, Radio } from 'lucide-react';

// ── Animated telemetry number ──────────────────────────────────────────────────
const TickingNumber = ({ value, suffix = '' }: { value: string; suffix?: string }) => {
  return (
    <span className="font-mono tabular-nums text-cyan-400">{value}{suffix}</span>
  );
};

// ── Status badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ label, color }: { label: string; color: 'green' | 'yellow' | 'red' }) => {
  const map = {
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
  };
  const dot = {
    green: 'bg-green-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono tracking-widest ${map[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[color]} animate-pulse`} />
      {label}
    </span>
  );
};

// ── Telemetry row ──────────────────────────────────────────────────────────────
const TelRow = ({ label, value, unit, color = 'white' }: { label: string; value: string; unit?: string; color?: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5">
    <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">{label}</span>
    <span className={`text-xs font-mono font-bold ${color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-300' : 'text-white'}`}>
      {value}{unit && <span className="text-gray-500 ml-1 font-normal">{unit}</span>}
    </span>
  </div>
);

// ── Main Hero ──────────────────────────────────────────────────────────────────
export const Hero = ({ onEnterDashboard }: { onEnterDashboard: () => void }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 20 });

  // Parallax transforms for the hero image layers
  const bgX = useTransform(springX, [-1, 1], ['-1.5%', '1.5%']);
  const bgY = useTransform(springY, [-1, 1], ['-1.5%', '1.5%']);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseX.set(x);
    mouseY.set(y);
  };

  // Fake-live telemetry values
  const temp = (273.2 + Math.sin(tick * 0.05) * 3.1).toFixed(1);
  const voltage = (28.3 + Math.sin(tick * 0.08 + 1) * 0.4).toFixed(2);
  const snr = (18.6 + Math.sin(tick * 0.12 + 2) * 1.2).toFixed(1);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-screen overflow-hidden bg-[#01020a] text-white select-none"
    >
      {/* ── Photorealistic hero image (parallax layer) ─────────────────── */}
      <motion.div
        className="absolute inset-[-4%] z-0"
        style={{ x: bgX, y: bgY }}
      >
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: 'url(/hero-scene.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
        />
        {/* Dark vignette + left gradient for typography readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_rgba(1,2,10,0.55)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#01020a] via-[#01020a]/65 to-transparent" />
        {/* Bottom fade into dashboard */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#01020a] to-transparent" />
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#01020a]/60 to-transparent" />
      </motion.div>

      {/* ── Three.js overlay: stars + orbital curves ────────────────────── */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <Scene />
      </div>

      {/* Invisible HTML click hotspot over satellite */}
      <div
        onClick={() => setShowInfo(true)}
        className="absolute z-[5] cursor-pointer hidden lg:block opacity-0"
        style={{ top: '12%', right: '12%', width: '42%', height: '60%' }}
        title="Inspect Satellite"
      />

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="absolute top-0 w-full z-20 flex justify-between items-center px-8 md:px-14 py-7 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-3 pointer-events-auto cursor-pointer"
        >
          <Satellite className="text-cyan-400" size={20} strokeWidth={1.5} />
          <span className="font-bold tracking-[0.25em] text-sm text-white">OFFBEAT</span>
          <span className="hidden md:block w-px h-4 bg-white/20" />
          <span className="hidden md:block text-[10px] font-mono tracking-[0.15em] text-gray-500 uppercase">
            Catch the channel that's off beat
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="hidden md:flex items-center gap-10 text-[11px] font-medium tracking-[0.18em] text-gray-400 pointer-events-auto"
        >
          {['OVERVIEW', 'TELEMETRY', 'ANOMALIES', 'REPORTS'].map((item, i) => (
            <motion.a
              key={item}
              href="#"
              whileHover={{ color: '#ffffff' }}
              className="transition-colors hover:text-white"
            >
              {item}
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-auto"
        >
          <button
            onClick={onEnterDashboard}
            className="px-5 py-2 border border-white/20 text-white text-[11px] font-bold tracking-[0.15em] uppercase hover:bg-white hover:text-black transition-all duration-200"
          >
            Launch Dashboard
          </button>
        </motion.div>
      </nav>

      {/* ── Main typography ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-center px-10 md:px-20 lg:px-28">
        <div className="max-w-2xl">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex items-center gap-3 mb-7"
          >
            <span className="w-10 h-px bg-cyan-400" />
            <span className="text-cyan-400 font-mono text-[11px] tracking-[0.25em] uppercase">
              Secure Uplink Established
            </span>
            <StatusBadge label="NOMINAL" color="green" />
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.65 }}
            className="text-[clamp(60px,8.5vw,125px)] font-extrabold tracking-[-0.04em] leading-[0.88] text-white mb-3"
            style={{ textShadow: '0 0 80px rgba(34,211,238,0.15)' }}
          >
            OFFBEAT
          </motion.h1>

          {/* Sub-title / Tagline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-[clamp(13px,1.4vw,17px)] font-light tracking-[0.22em] text-cyan-400 uppercase mb-10"
          >
            Catch the channel that's off beat
          </motion.h2>

          {/* Quote / Idea */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 1 }}
            className="border-l-2 border-cyan-500/50 pl-6 mb-12"
          >
            <p className="text-[clamp(18px,2.2vw,26px)] font-normal leading-snug text-white mb-3">
              "A channel that falls out of its normal beat —<br />
              that's what the detector looks for."
            </p>
            <p className="text-[clamp(13px,1.2vw,15px)] text-gray-400 leading-relaxed max-w-sm">
              Continuous multi-channel telemetry anomaly detection, residual error tracking, and autonomous spacecraft health intelligence.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15 }}
            className="flex flex-col sm:flex-row gap-4 pointer-events-auto"
          >
            <motion.button
              onClick={onEnterDashboard}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-extrabold uppercase tracking-[0.15em] text-[12px] hover:bg-cyan-400 hover:text-black transition-all duration-200 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
            >
              ENTER MISSION CONTROL
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <motion.button
              onClick={() => setShowInfo(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-3 px-8 py-4 border border-white/25 text-white font-bold uppercase tracking-[0.15em] text-[12px] hover:border-white/60 hover:bg-white/5 transition-all duration-200 backdrop-blur-sm"
            >
              <Radio size={14} />
              EXPLORE TELEMETRY
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ── Live telemetry ticker (bottom strip) ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.6 }}
        className="absolute bottom-6 left-10 md:left-20 right-10 md:right-20 z-20 pointer-events-none"
      >
        <div className="flex items-center gap-6 md:gap-12 text-[10px] font-mono text-gray-500">
          <span className="flex items-center gap-2">
            <span className="text-gray-600">RADIATOR TEMP</span>
            <TickingNumber value={temp} suffix=" K" />
          </span>
          <span className="hidden md:flex items-center gap-2">
            <span className="text-gray-600">BUS VOLTAGE</span>
            <TickingNumber value={voltage} suffix=" V" />
          </span>
          <span className="hidden md:flex items-center gap-2">
            <span className="text-gray-600">LINK S/N</span>
            <TickingNumber value={snr} suffix=" dB" />
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 font-bold">1 ANOMALY ACTIVE</span>
          </span>
        </div>
      </motion.div>

      {/* ── Click-satellite annotation ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
        className="absolute z-20 pointer-events-none hidden lg:block"
        style={{ top: '22%', right: '22%' }}
      >
        <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400/60 tracking-widest">
          <span className="w-8 h-px bg-cyan-400/30" />
          CLICK TO INSPECT
        </div>
      </motion.div>

      {/* ── Info / Telemetry side-panel ─────────────────────────────────── */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute top-0 right-0 bottom-0 w-full md:w-[420px] bg-[#020610]/95 backdrop-blur-3xl border-l border-white/8 z-50 pointer-events-auto flex flex-col"
          >
            {/* Panel header */}
            <div className="px-8 py-7 border-b border-white/5 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Satellite size={14} className="text-cyan-400" strokeWidth={1.5} />
                  <h3 className="text-[11px] font-bold tracking-[0.25em] text-cyan-400 uppercase">
                    Telemetry Preview
                  </h3>
                </div>
                <p className="text-[10px] text-gray-600 font-mono">OFFBEAT · LEO-582km · Inc 97.4°</p>
              </div>
              <button onClick={() => setShowInfo(false)} className="p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

              {/* Live readings */}
              <div>
                <h4 className="text-[10px] font-mono text-gray-600 tracking-widest uppercase mb-3">Live Readings</h4>
                <div className="bg-white/[0.025] border border-white/5 rounded-sm p-4">
                  <TelRow label="Radiator Temp" value={temp} unit="K" color={parseFloat(temp) > 275 ? 'red' : 'white'} />
                  <TelRow label="Bus Voltage" value={voltage} unit="V" />
                  <TelRow label="Link S/N Ratio" value={snr} unit="dB" color={parseFloat(snr) < 18 ? 'yellow' : 'white'} />
                  <TelRow label="Altitude" value="582.4" unit="km" />
                  <TelRow label="Inclination" value="97.41" unit="°" />
                </div>
              </div>

              {/* Subsystem status */}
              <div>
                <h4 className="text-[10px] font-mono text-gray-600 tracking-widest uppercase mb-3">Subsystem Status</h4>
                <div className="space-y-3">

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm hover:border-white/15 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Activity size={14} className="text-green-400" />
                        <span className="text-[11px] font-mono tracking-wider">POWER</span>
                      </div>
                      <StatusBadge label="NOMINAL" color="green" />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">Solar array voltage within expected operational limits. Battery at 94% SoC.</p>
                  </div>

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm hover:border-white/15 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Radio size={14} className="text-yellow-400" />
                        <span className="text-[11px] font-mono tracking-wider">COMMS</span>
                      </div>
                      <StatusBadge label="WATCH" color="yellow" />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">Slight jitter in downlink S-band channel. Trending toward normal. Monitoring.</p>
                  </div>

                  <div className="p-4 bg-red-500/[0.06] border border-red-500/20 rounded-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-0.5 h-full bg-red-500" />
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={14} className="text-red-400" />
                        <span className="text-[11px] font-mono tracking-wider text-red-400">THERMAL</span>
                      </div>
                      <StatusBadge label="ANOMALY" color="red" />
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Telemanom detected deviation at T-minus 12m. Radiator loop B temperature variance exceeds 3σ threshold. Isolation Forest confirms.</p>
                  </div>

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm hover:border-white/15 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Cpu size={14} className="text-green-400" />
                        <span className="text-[11px] font-mono tracking-wider">OBC</span>
                      </div>
                      <StatusBadge label="NOMINAL" color="green" />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">On-board computer operating nominally. Memory utilisation 67%.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Panel footer */}
            <div className="px-8 py-6 border-t border-white/5">
              <button
                onClick={onEnterDashboard}
                className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold uppercase tracking-[0.15em] text-[11px] transition-colors"
              >
                Investigate Anomaly →
              </button>
              <p className="text-center text-[10px] text-gray-700 font-mono mt-3">
                Visual representation · Not a live spacecraft feed
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Hero;
