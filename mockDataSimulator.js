/**
 * PolarGrid AI - Mock Data Simulator
 * Generates realistic energy management data with random-walk variations
 * Updates every 3-5 seconds for live dashboard experience
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// INITIALIZATION
// ============================================================================

const STATION_ID = 'bharati-research-station-2026';

// Base configuration
const CONFIG = {
  solar_capacity_kw: 50,
  wind_capacity_kw: 100,
  diesel_capacity_kw: 150,
  battery_capacity_kwh: 500,
  fuel_cell_capacity_kw: 30,
  typical_load_kw: 80,
  battery_charge_rate: 20,
  battery_discharge_rate: 30
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let simulationState = {
  timestamp: new Date(),
  
  // Generation (kW)
  solar_kw: 0,
  wind_kw: 35,
  diesel_kw: 0,
  fuel_cell_kw: 0,
  
  // Battery (kWh)
  battery_soc: 65, // State of charge %
  battery_health: 98, // Health %
  battery_discharge_kw: 0,
  
  // Load (kW)
  total_load_kw: 80,
  heating_load_kw: 45,
  research_load_kw: 35,
  
  // Weather
  temperature: -25,
  wind_speed: 18,
  solar_irradiance: 0,
  
  // Dispatch strategy
  dispatch_strategy: 'Renewable Priority',
  diesel_status: 'standby',
  
  // Simulation state
  is_storm: false,
  is_comms_outage: false,
  equipment_failure: null,
  
  // Alerts
  alerts: [],
  active_alert_count: 0
};

// ============================================================================
// RANDOM WALK GENERATOR
// ============================================================================

/**
 * Generate random walk value with constraints
 * Simulates realistic sensor data variations
 */
function randomWalk(current, min, max, stepSize = 2, probability = 0.7) {
  // 70% chance of small change, 30% stays same
  if (Math.random() > probability) {
    return current;
  }
  
  const change = (Math.random() - 0.5) * stepSize * 2;
  let newValue = current + change;
  
  // Constrain to bounds
  return Math.max(min, Math.min(max, newValue));
}

/**
 * Sinusoidal variation for solar (realistic day/night cycle)
 */
function solarCycle(hour) {
  // Peak at noon (hour 12), zero at night (0-6, 18-24)
  const normalizedHour = (hour + 24) % 24;
  if (normalizedHour < 6 || normalizedHour > 18) {
    return 0; // Night
  }
  // Cosine curve peaks at noon
  const peakHour = 12;
  const widthHours = 12;
  const angle = ((normalizedHour - peakHour) / (widthHours / 2)) * Math.PI;
  return Math.max(0, Math.cos(angle) * CONFIG.solar_capacity_kw * 0.8);
}

// ============================================================================
// DISPATCH LOGIC (Simplified AI)
// ============================================================================

function computeDispatchDecision(state) {
  const generation = state.solar_kw + state.wind_kw + state.fuel_cell_kw;
  const load = state.total_load_kw;
  const balance = generation - load;
  
  let decision = {
    solar_dispatch_kw: state.solar_kw,
    wind_dispatch_kw: state.wind_kw,
    diesel_dispatch_kw: 0,
    battery_dispatch_kw: 0,
    fuel_cell_dispatch_kw: 0,
    reason: '',
    confidence: 0.95
  };
  
  // Priority: Solar → Wind → Battery → Fuel Cell → Diesel
  
  if (balance > 0) {
    // Surplus: charge battery or curtail
    if (state.battery_soc < 95) {
      const charge_kw = Math.min(balance, CONFIG.battery_charge_rate);
      decision.battery_dispatch_kw = -charge_kw; // negative = charge
      decision.reason = 'Charging battery from renewable surplus';
    } else {
      decision.reason = 'Battery full; renewable surplus';
    }
  } else if (balance < 0) {
    // Deficit: discharge battery or use generators
    const deficit = -balance;
    
    if (state.battery_soc > 20) {
      const discharge_kw = Math.min(deficit, CONFIG.battery_discharge_rate);
      decision.battery_dispatch_kw = discharge_kw; // positive = discharge
      decision.reason = `Discharging battery (SOC: ${state.battery_soc.toFixed(0)}%)`;
    } else if (state.battery_soc <= 20 && state.battery_soc > 10) {
      const discharge_kw = Math.min(deficit * 0.5, CONFIG.battery_discharge_rate);
      decision.battery_dispatch_kw = discharge_kw;
      decision.fuel_cell_dispatch_kw = Math.min(deficit * 0.5, CONFIG.fuel_cell_capacity_kw);
      decision.reason = 'Low battery: Fuel cell + minimal discharge';
    } else {
      // Emergency: use diesel
      decision.diesel_dispatch_kw = deficit;
      decision.reason = '⚠️ CRITICAL: Diesel engaged (low battery)';
    }
  } else {
    decision.reason = 'Balanced load and generation';
  }
  
  return decision;
}

// ============================================================================
// UPDATE CYCLE
// ============================================================================

/**
 * Update simulation state with realistic variations
 */
export function updateSimulationState() {
  const now = new Date();
  const hour = now.getHours();
  
  // ========== GENERATION ==========
  
  // Solar (realistic day/night)
  const baseSolar = solarCycle(hour);
  simulationState.solar_kw = randomWalk(baseSolar, 0, CONFIG.solar_capacity_kw, 3);
  
  // Wind (continuous, random walk)
  simulationState.wind_kw = randomWalk(
    simulationState.wind_kw,
    0,
    CONFIG.wind_capacity_kw,
    5,
    0.8
  );
  
  // ========== WEATHER ==========
  
  // Temperature (realistic variation, colder at night)
  const baseTemp = -30 + 8 * Math.cos((hour / 12) * Math.PI); // -30 to -22
  simulationState.temperature = randomWalk(baseTemp, -45, -15, 1);
  
  // Wind speed correlation with wind power
  simulationState.wind_speed = Math.sqrt(simulationState.wind_kw / 100) * 25 + 
                                randomWalk(0, -5, 5, 2);
  
  // Solar irradiance
  simulationState.solar_irradiance = simulationState.solar_kw / CONFIG.solar_capacity_kw * 900;
  
  // ========== LOAD ==========
  
  // Total load (baseline + variations)
  const baseLoad = CONFIG.typical_load_kw + (Math.random() - 0.5) * 10;
  simulationState.total_load_kw = randomWalk(baseLoad, 60, 120, 3, 0.9);
  simulationState.heating_load_kw = simulationState.total_load_kw * 0.55;
  simulationState.research_load_kw = simulationState.total_load_kw * 0.45;
  
  // ========== DISPATCH & BATTERY ==========
  
  const dispatch = computeDispatchDecision(simulationState);
  
  // Update battery SOC
  const netBattery = dispatch.battery_dispatch_kw; // -charge, +discharge
  const socChange = -(netBattery / CONFIG.battery_capacity_kwh) * (5 / 60); // per 5-sec update
  simulationState.battery_soc = Math.max(0, Math.min(100, 
    simulationState.battery_soc + socChange
  ));
  
  // Battery health degrades slowly
  simulationState.battery_health = Math.max(85, 
    simulationState.battery_health - 0.0001
  );
  
  // ========== HANDLE SIMULATIONS ==========
  
  if (simulationState.is_storm) {
    simulationState.wind_kw = 20; // Reduced turbine output (icing)
    simulationState.wind_speed = 65; // Extreme
    if (!simulationState.alerts.find(a => a.id === 'storm-alert')) {
      simulationState.alerts.push({
        id: 'storm-alert',
        type: 'critical',
        title: '⚠️ SEVERE STORM INCOMING',
        description: 'Wind speed exceeds 80 km/h. Turbine de-icing activated. Battery discharge increased.',
        created_at: new Date().toISOString()
      });
    }
  }
  
  if (simulationState.is_comms_outage) {
    if (!simulationState.alerts.find(a => a.id === 'comms-alert')) {
      simulationState.alerts.push({
        id: 'comms-alert',
        type: 'warning',
        title: '🚨 COMMUNICATIONS OUTAGE',
        description: 'Satellite link down. Operating in island mode. AI running on-edge.',
        created_at: new Date().toISOString()
      });
    }
  }
  
  if (simulationState.equipment_failure) {
    if (!simulationState.alerts.find(a => a.id === 'equipment-alert')) {
      simulationState.alerts.push({
        id: 'equipment-alert',
        type: 'critical',
        title: '❌ EQUIPMENT FAILURE DETECTED',
        description: `${simulationState.equipment_failure} malfunction. Switched to backup system.`,
        created_at: new Date().toISOString()
      });
    }
  }
  
  // Clean up old alerts
  if (simulationState.alerts.length > 10) {
    simulationState.alerts = simulationState.alerts.slice(-10);
  }
  
  simulationState.active_alert_count = simulationState.alerts.length;
  simulationState.timestamp = now;
  
  return {
    ...simulationState,
    dispatch: dispatch
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current simulation state (formatted for frontend)
 */
export function getCurrentState() {
  return updateSimulationState();
}

/**
 * Trigger a scenario simulation
 */
export function triggerSimulation(scenarioType) {
  switch (scenarioType) {
    case 'storm':
      simulationState.is_storm = true;
      setTimeout(() => {
        simulationState.is_storm = false;
        simulationState.alerts = simulationState.alerts.filter(a => a.id !== 'storm-alert');
      }, 30000); // 30 seconds
      break;
      
    case 'comms_outage':
      simulationState.is_comms_outage = true;
      setTimeout(() => {
        simulationState.is_comms_outage = false;
        simulationState.alerts = simulationState.alerts.filter(a => a.id !== 'comms-alert');
      }, 20000); // 20 seconds
      break;
      
    case 'equipment_failure':
      simulationState.equipment_failure = 'Solar Inverter';
      setTimeout(() => {
        simulationState.equipment_failure = null;
        simulationState.alerts = simulationState.alerts.filter(a => a.id !== 'equipment-alert');
      }, 25000); // 25 seconds
      break;
  }
}

/**
 * Reset simulation to normal
 */
export function resetSimulation() {
  simulationState.is_storm = false;
  simulationState.is_comms_outage = false;
  simulationState.equipment_failure = null;
  simulationState.alerts = [];
}

/**
 * Get historical data (mock 24-hour history)
 */
export function getHistoricalData(days = 7) {
  const data = [];
  const now = new Date();
  
  for (let d = days; d >= 0; d--) {
    for (let h = 0; h < 24; h += 3) { // 3-hour intervals
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(h);
      
      const solarOutput = solarCycle(h) * (0.8 + Math.random() * 0.2);
      const windOutput = 30 + Math.random() * 40;
      const renewable = solarOutput + windOutput;
      
      data.push({
        date: date.toISOString(),
        renewable_kw: renewable,
        diesel_kw: Math.max(0, 80 - renewable),
        battery_soc: 50 + Math.random() * 30,
        load_kw: 70 + Math.random() * 30
      });
    }
  }
  
  return data;
}

/**
 * Calculate daily KPIs (mock)
 */
export function getDailyKPIs(days = 30) {
  const data = [];
  const now = new Date();
  
  for (let d = days; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    
    const renewableFraction = 0.65 + Math.random() * 0.25; // 65-90%
    const dieselUsed = (1 - renewableFraction) * 200;
    const co2Avoided = renewableFraction * 150; // kg CO2
    
    data.push({
      date: date.toISOString().split('T')[0],
      renewable_fraction: renewableFraction,
      diesel_consumed: dieselUsed,
      co2_avoided: co2Avoided,
      uptime: 99.8 + Math.random() * 0.2,
      energy_generated: 1500 + Math.random() * 200,
      energy_consumed: 1600 + Math.random() * 150
    });
  }
  
  return data;
}

/**
 * Get 24-hour dispatch plan
 */
export function get24HourDispatchPlan() {
  const plan = [];
  const now = new Date();
  
  for (let h = 0; h < 24; h++) {
    const time = new Date(now);
    time.setHours(now.getHours() + h);
    
    const solar = solarCycle(time.getHours());
    const wind = 35 + Math.random() * 30;
    const renewable = solar + wind;
    const load = 80 + (Math.random() - 0.5) * 20;
    const balance = renewable - load;
    
    let battery_dispatch = 0;
    let diesel_dispatch = 0;
    let reason = '';
    
    if (balance > 0) {
      battery_dispatch = -Math.min(balance, 20); // charge
      reason = 'Charging from renewable surplus';
    } else if (balance < 0) {
      const deficit = -balance;
      battery_dispatch = Math.min(deficit, 30); // discharge
      if (battery_dispatch < deficit) {
        diesel_dispatch = deficit - battery_dispatch;
        reason = 'Battery + Diesel';
      } else {
        reason = 'Battery discharge';
      }
    } else {
      reason = 'Balanced';
    }
    
    plan.push({
      time: time.toISOString(),
      solar,
      wind,
      diesel: diesel_dispatch,
      battery: battery_dispatch,
      load,
      reason
    });
  }
  
  return plan;
}

// ============================================================================
// EXPORT DEFAULT SIMULATOR
// ============================================================================

export default {
  updateSimulationState,
  getCurrentState,
  triggerSimulation,
  resetSimulation,
  getHistoricalData,
  getDailyKPIs,
  get24HourDispatchPlan
};
