import React, { useState } from 'react';
import Hero from './Hero';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { EventsPage } from './pages/EventsPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { SpaceDashboard } from './pages/SpaceDashboard';
import { EvidencePage } from './pages/EvidencePage';
import { SystemPage } from './pages/SystemPage';

function App() {
  const [view, setView] = useState<'hero' | 'dashboard'>('hero');
  const [page, setPage] = useState<
    'dashboard' | 'overview' | 'telemetry' | 'events' | 'evaluation' | 'evidence' | 'system'
  >('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <SpaceDashboard />;
      case 'overview':
        return <OverviewPage onNavigateEvents={() => setPage('events')} />;
      case 'telemetry':
        return <TelemetryPage />;
      case 'events':
        return <EventsPage />;
      case 'evaluation':
        return <EvaluationPage />;
      case 'evidence':
        return <EvidencePage />;
      case 'system':
        return <SystemPage />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full">
      {view === 'hero' ? (
        <Hero onEnterDashboard={() => setView('dashboard')} />
      ) : (
        <AppShell currentPage={page} onNavigate={setPage} onBackToHero={() => setView('hero')}>
          {renderPage()}
        </AppShell>
      )}
    </div>
  );
}

export default App;
