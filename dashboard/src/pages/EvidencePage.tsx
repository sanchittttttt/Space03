import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Sparkles, Send, Search,
  ExternalLink, ShieldAlert, CheckCircle2, ChevronRight,
  Layers, FileText, Bot, RefreshCw
} from 'lucide-react';
import { apiService, GLOSSARY_TOPICS, type RagSource, type StructuredReport } from '../data/apiService';

const SUGGESTED_PROMPTS = [
  'What does triage priority engineering_review mean?',
  'How does Isolation Forest detect anomalies compared to Telemanom LSTM?',
  'Explain the difference between point and contextual anomalies',
  'What are the operational limitations of this detector?',
  'What is lead time and how early are anomalies flagged?',
];

export const EvidencePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assistant' | 'glossary' | 'reports'>('assistant');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    text: string;
    sources?: RagSource[];
    generation?: string;
  }>>([
    {
      role: 'assistant',
      text: 'Welcome to the OFFBEAT Grounded Evidence & RAG Assistant. I am connected to the mission anomaly documentation, NASA Telemanom research, and rule-based triage specifications. Ask any question regarding spacecraft telemetry deviations, classification heuristics, or detector behavior.',
    },
  ]);

  const [glossarySearch, setGlossarySearch] = useState('');
  const [reportChannel, setReportChannel] = useState('61');
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedSource, setExpandedSource] = useState<RagSource | null>(null);

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || loading) return;

    setChatHistory(prev => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      const resp = await apiService.askQuestion(q, {
        channel_group: 'T',
        detector: 'isolation_forest',
      });
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: resp.answer,
          sources: resp.sources,
          generation: resp.generation,
        },
      ]);
    } catch {
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Encountered an issue querying the knowledge index. Please review the glossary below.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadReport = async (ch: string) => {
    setReportChannel(ch);
    setReportLoading(true);
    try {
      const data = await apiService.getReport(ch);
      setReport(data);
    } finally {
      setReportLoading(false);
    }
  };

  const filteredGlossary = GLOSSARY_TOPICS.filter(
    t =>
      t.title.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      t.summary.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(glossarySearch.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060b14] overflow-hidden text-gray-200">
      {/* ── Top Bar / Sub-Nav ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#1a2a3d] bg-[#07101d]/60 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="text-cyan-400" size={18} />
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-white">
              Evidence & RAG Knowledge Engine
            </h1>
            <p className="text-[10px] font-mono text-gray-500">
              Grounded Operator Evidence · Zero Hallucination Retrieval · Cited Source Documentation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#0a1829] p-1 rounded-sm border border-[#1a2a3d]">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'assistant'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bot size={13} />
            RAG Assistant
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'glossary'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText size={13} />
            Glossary & Rules
          </button>
          <button
            onClick={() => {
              setActiveTab('reports');
              if (!report) handleLoadReport('61');
            }}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert size={13} />
            Triage Reports
          </button>
        </div>
      </div>

      {/* ── Main Tab Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-6">
        {/* ── TAB 1: RAG Assistant ───────────────────────────────────── */}
        {activeTab === 'assistant' && (
          <div className="flex flex-col h-full max-w-5xl mx-auto bg-[#07101d] border border-[#1a2a3d] rounded-sm overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-sm bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div
                    className={`max-w-[78%] rounded-sm p-4 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-cyan-600/20 border border-cyan-500/40 text-cyan-100'
                        : 'bg-[#0a1829] border border-[#1a2a3d] text-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {/* Sources section */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                        <div className="text-[10px] font-mono text-cyan-400/80 tracking-widest uppercase flex items-center gap-1.5">
                          <Layers size={11} /> Grounded Sources & Citations:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((s, idx) => (
                            <button
                              key={idx}
                              onClick={() => setExpandedSource(s)}
                              className="text-[10px] font-mono bg-white/[0.04] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 px-2.5 py-1 rounded-sm text-cyan-300 transition-colors flex items-center gap-1.5"
                            >
                              <span className="font-bold text-cyan-400">[{s.citation_id}]</span>
                              <span>{s.source_title}</span>
                              <ChevronRight size={10} className="text-gray-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-sm bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400 font-mono text-xs font-bold">
                      OP
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <div className="flex gap-3 items-center text-cyan-400 font-mono text-xs">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Retrieving knowledge passages and evaluating citation relevance...</span>
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div className="px-6 py-2 border-t border-[#1a2a3d] bg-[#060f1a] flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
              <span className="text-gray-500 flex-shrink-0">Quick Queries:</span>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAsk(prompt)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-sm bg-[#0a1829] hover:bg-cyan-500/15 border border-[#1a2a3d] hover:border-cyan-500/30 text-gray-300 hover:text-white transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input bar */}
            <div className="p-4 border-t border-[#1a2a3d] bg-[#07101d] flex gap-3">
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder="Ask about anomaly detection, triage priority rules, detector scores, or limitations..."
                className="flex-1 bg-[#0a1829] border border-[#1a2a3d] focus:border-cyan-400/60 rounded-sm px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
              />
              <button
                onClick={() => handleAsk()}
                disabled={loading || !question.trim()}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black font-bold uppercase tracking-wider text-xs rounded-sm transition-all flex items-center gap-2"
              >
                <Send size={13} />
                Ask RAG
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: Glossary & Specifications ────────────────────────── */}
        {activeTab === 'glossary' && (
          <div className="h-full flex flex-col max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={glossarySearch}
                  onChange={e => setGlossarySearch(e.target.value)}
                  placeholder="Search glossary definitions, standards, and rules..."
                  className="w-full bg-[#07101d] border border-[#1a2a3d] rounded-sm pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none font-mono"
                />
              </div>
              <span className="text-[11px] font-mono text-gray-500">
                {filteredGlossary.length} Topics Indexed
              </span>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-1">
              {filteredGlossary.map(topic => (
                <div
                  key={topic.id}
                  className="p-5 bg-[#07101d] border border-[#1a2a3d] hover:border-cyan-500/30 rounded-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-white tracking-wide">{topic.title}</h3>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-sm">
                        {topic.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">{topic.summary}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-500">
                    <span className="truncate max-w-[280px]">Source: {topic.source}</span>
                    <div className="flex gap-1.5">
                      {topic.tags.map(tag => (
                        <span key={tag} className="text-gray-400 bg-white/[0.03] px-1.5 py-0.5 rounded-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Structured Triage Reports ────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="h-full flex flex-col max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#07101d] border border-[#1a2a3d] rounded-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400">Select Telemetry Channel:</span>
                <div className="flex gap-2">
                  {['61', '62', '63', 'P-1', 'T-1'].map(ch => (
                    <button
                      key={ch}
                      onClick={() => handleLoadReport(ch)}
                      className={`px-3 py-1 rounded-sm text-xs font-mono font-bold transition-all ${
                        reportChannel === ch
                          ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                          : 'bg-[#0a1829] text-gray-400 hover:text-white border border-[#1a2a3d]'
                      }`}
                    >
                      {ch.startsWith('channel_') ? ch : `Channel ${ch}`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleLoadReport(reportChannel)}
                disabled={reportLoading}
                className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw size={12} className={reportLoading ? 'animate-spin' : ''} />
                Regenerate Scan
              </button>
            </div>

            {report && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Summary Card */}
                <div className="p-5 bg-[#07101d] border border-[#1a2a3d] rounded-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white uppercase">{report.channel} Report</span>
                      <span className="text-[10px] font-mono text-gray-500">
                        Generated {new Date(report.generated_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-mono">
                        {report.triage_summary.urgent_review} Urgent
                      </span>
                      <span className="px-2 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono">
                        {report.triage_summary.engineering_review} Engineering
                      </span>
                      <span className="px-2 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono">
                        {report.triage_summary.routine_monitoring} Routine
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed bg-[#0a1829] p-3 rounded-sm border border-white/5 font-mono">
                    {report.summary}
                  </p>
                </div>

                {/* Anomalies List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                    Detected Anomalous Intervals ({report.anomalies.length})
                  </h4>

                  {report.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className="p-5 bg-[#07101d] border border-[#1a2a3d] hover:border-cyan-500/30 rounded-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-white">
                            Interval #{idx + 1}: Steps {anomaly.start_sample} → {anomaly.end_sample}
                          </span>
                          <span className="text-[11px] font-mono text-cyan-400">
                            Duration: {anomaly.duration_steps} timesteps
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider ${
                            anomaly.triage.priority === 'urgent_review'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}
                        >
                          {anomaly.triage.priority.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#0a1829] rounded-sm text-[11px] font-mono mb-3">
                        <div>
                          <span className="text-gray-500 block">Outlier Score</span>
                          <span className="font-bold text-red-400">{anomaly.anomaly_score.toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Threshold</span>
                          <span className="text-gray-300">{anomaly.threshold.toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Margin</span>
                          <span className="text-cyan-400 font-bold">+{anomaly.score_margin.toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Mean In-Window</span>
                          <span className="text-gray-300">{anomaly.supporting_measurements.mean.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">
                          Triage Rule Decisions:
                        </span>
                        {anomaly.triage.reasons.map((r, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-2 text-xs text-gray-300">
                            <CheckCircle2 size={12} className="text-cyan-400 flex-shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Source Details Drawer ─────────────────────────────────────── */}
      <AnimatePresence>
        {expandedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setExpandedSource(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="max-w-xl w-full bg-[#07101d] border border-cyan-500/40 rounded-sm p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                    Citation [{expandedSource.citation_id}]
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">{expandedSource.source_title}</h3>
                  <p className="text-xs font-mono text-gray-400">{expandedSource.section}</p>
                </div>
                <button
                  onClick={() => setExpandedSource(null)}
                  className="text-gray-500 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 bg-[#0a1829] border border-white/5 rounded-sm text-xs text-gray-200 leading-relaxed max-h-60 overflow-y-auto">
                {expandedSource.passage}
              </div>

              {expandedSource.source_path && (
                <div className="text-[11px] font-mono text-gray-500 flex items-center justify-between">
                  <span>File: {expandedSource.source_path}</span>
                  {expandedSource.source_url && (
                    <a
                      href={expandedSource.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      View Source <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EvidencePage;
