/**
 * PolarGrid AI Dashboard
 * AI-Driven Energy Management System for Polar Research Stations
 * 
 * Pages:
 * 1. Overview - Real-time status & power flow
 * 2. Forecasting - 24h weather & generation forecast
 * 3. AI Dispatch - Dispatch decisions & strategy
 * 4. Energy Sources - Detailed energy source breakdown
 * 5. KPIs & Sustainability - Performance metrics
 * 6. Equipment Health - Equipment status & maintenance
 * 7. Communications - Network & connectivity status
 * 8. Settings - Scenario simulator & preferences
 */

import React, { useState, useEffect } from 'react';
import './App.css';

// Components
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/Overview';
import ForecastingPage from './pages/Forecasting';
import AIDispatchPage from './pages/AIDispatch';
import EnergySourcesPage from './pages/EnergySources';
import KPIsPage from './pages/KPIs';
import EquipmentHealthPage from './pages/EquipmentHealth';
import CommunicationsPage from './pages/Communications';
import SettingsPage from './pages/Settings';

// Utils
import simulator from './utils/mockDataSimulator';

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [currentPage, setCurrentPage] = useState('overview');
  const [systemState, setSystemState] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [dispatchPlan, setDispatchPlan] = useState([]);

  // Initialize and update simulation
  useEffect(() => {
    // Initial load
    const initial = simulator.getCurrentState();
    setSystemState(initial);
    setHistoricalData(simulator.getHistoricalData(7));
    setKpiData(simulator.getDailyKPIs(30));
    setDispatchPlan(simulator.get24HourDispatchPlan());

    // Update every 3-5 seconds
    const interval = setInterval(() => {
      const state = simulator.getCurrentState();
      setSystemState(state);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!systemState) {
    return (
      <div className="app loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>PolarGrid AI initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app dark-mode">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      <main className="dashboard-main">
        {currentPage === 'overview' && <OverviewPage state={systemState} />}
        {currentPage === 'forecasting' && <ForecastingPage state={systemState} />}
        {currentPage === 'dispatch' && <AIDispatchPage dispatchPlan={dispatchPlan} state={systemState} />}
        {currentPage === 'energy-sources' && <EnergySourcesPage state={systemState} />}
        {currentPage === 'kpis' && <KPIsPage kpiData={kpiData} />}
        {currentPage === 'equipment' && <EquipmentHealthPage state={systemState} />}
        {currentPage === 'communications' && <CommunicationsPage state={systemState} />}
        {currentPage === 'settings' && <SettingsPage onSimulation={(type) => simulator.triggerSimulation(type)} />}
      </main>
    </div>
  );
}

export default App;
