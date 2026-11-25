'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar, ScreenId } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';

import { DashboardView } from '@/components/dashboard/DashboardView';
import { MapView } from '@/components/map/MapView';
import { RedListView } from '@/components/redlist/RedListView';
import { CentreDetailView } from '@/components/centre/CentreDetailView';
import { AlertsView } from '@/components/alerts/AlertsView';
import { StatsView } from '@/components/stats/StatsView';
import { HistoryView } from '@/components/history/HistoryView';
import { LiveView } from '@/components/live/LiveView';
import { HealthView } from '@/components/health/HealthView';
import { SecondAvisView } from '@/components/secondavis/SecondAvisView';

export default function HomePage() {
  const { user } = useAuth();
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [selectedCentreId, setSelectedCentreId] = useState<number>(70);

  const handleNavigate = (screen: ScreenId, centreId?: number) => {
    if (centreId !== undefined) {
      setSelectedCentreId(centreId);
    }
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1120]">
      {/* Sticky Top Header */}
      <Header />

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeScreen={activeScreen}
          onSelectScreen={(screen) => handleNavigate(screen)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* Remount screens when the profile changes so each one reloads its data for that profile */}
          <div className="mx-auto max-w-7xl" key={user.role}>
            {activeScreen === 'dashboard' && (
              <DashboardView onNavigate={handleNavigate} />
            )}

            {activeScreen === 'map' && (
              <MapView onNavigate={handleNavigate} />
            )}

            {activeScreen === 'redlist' && (
              <RedListView onNavigate={handleNavigate} />
            )}

            {activeScreen === 'centre' && (
              <CentreDetailView
                centreId={selectedCentreId}
                onNavigate={(screen) => handleNavigate(screen)}
              />
            )}

            {activeScreen === 'alerts' && <AlertsView />}

            {activeScreen === 'stats' && <StatsView />}

            {activeScreen === 'history' && <HistoryView />}

            {activeScreen === 'live' && <LiveView />}

            {activeScreen === 'health' && <HealthView />}

            {activeScreen === 'secondavis' && <SecondAvisView />}
          </div>
        </main>
      </div>

      {/* Fixed Legal / Supervision Disclaimer Footer */}
      <Footer />
    </div>
  );
}
