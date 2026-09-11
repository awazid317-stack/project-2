-- PolarGrid AI Database Schema
-- PostgreSQL 13+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Station Configuration
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
    latitude FLOAT,
    longitude FLOAT,
    capacity_kwh FLOAT DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Energy Sources Configuration
CREATE TABLE energy_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'solar', 'wind', 'diesel', 'battery', 'fuel_cell'
    capacity_kw FLOAT NOT NULL,
    efficiency FLOAT DEFAULT 0.85,
    min_output_kw FLOAT DEFAULT 0,
    max_output_kw FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_source_type CHECK (source_type IN ('solar', 'wind', 'diesel', 'battery', 'fuel_cell'))
);

-- 3. Real-time Sensor Data (TimescaleDB hypertable)
CREATE TABLE sensor_data (
    time TIMESTAMP NOT NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    sensor_type VARCHAR(100) NOT NULL,
    value FLOAT NOT NULL,
    unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('sensor_data', 'time', if_not_exists => TRUE);

-- 4. Energy Generation Metrics
CREATE TABLE energy_generation (
    time TIMESTAMP NOT NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    solar_kw FLOAT DEFAULT 0,
    wind_kw FLOAT DEFAULT 0,
    diesel_kw FLOAT DEFAULT 0,
    fuel_cell_kw FLOAT DEFAULT 0,
    battery_discharge_kw FLOAT DEFAULT 0,
    battery_soc FLOAT, -- State of Charge 0-100
    battery_health FLOAT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('energy_generation', 'time', if_not_exists => TRUE);

-- 5. Load/Consumption Data
CREATE TABLE load_consumption (
    time TIMESTAMP NOT NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    total_load_kw FLOAT NOT NULL,
    heating_load_kw FLOAT DEFAULT 0,
    research_load_kw FLOAT DEFAULT 0,
    essential_load_kw FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('load_consumption', 'time', if_not_exists => TRUE);

-- 6. AI Dispatch Decisions
CREATE TABLE dispatch_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    solar_dispatch_kw FLOAT DEFAULT 0,
    wind_dispatch_kw FLOAT DEFAULT 0,
    diesel_dispatch_kw FLOAT DEFAULT 0,
    battery_dispatch_kw FLOAT DEFAULT 0, -- positive=discharge, negative=charge
    fuel_cell_dispatch_kw FLOAT DEFAULT 0,
    decision_reason VARCHAR(500),
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('dispatch_decisions', 'timestamp', if_not_exists => TRUE);

-- 7. Weather Forecast
CREATE TABLE weather_forecast (
    time TIMESTAMP NOT NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    temperature_c FLOAT,
    wind_speed_ms FLOAT,
    solar_irradiance_w_m2 FLOAT,
    cloud_cover_percent FLOAT,
    forecast_confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('weather_forecast', 'time', if_not_exists => TRUE);

-- 8. Equipment Health & Maintenance
CREATE TABLE equipment_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    equipment_type VARCHAR(100) NOT NULL, -- 'solar_panel', 'wind_turbine', 'battery', 'diesel_gen', 'fuel_cell'
    equipment_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'normal', -- 'normal', 'warning', 'critical', 'offline'
    health_score FLOAT DEFAULT 100,
    last_maintenance TIMESTAMP,
    next_maintenance TIMESTAMP,
    issue_detected VARCHAR(500),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Alerts & Events
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- 'critical', 'warning', 'info'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- 10. Historical Performance KPIs
CREATE TABLE kpi_daily (
    date DATE NOT NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    renewable_fraction FLOAT, -- % of energy from renewables
    diesel_consumed_liters FLOAT,
    co2_emitted_kg FLOAT,
    uptime_percent FLOAT,
    energy_generated_kwh FLOAT,
    energy_consumed_kwh FLOAT,
    grid_balance_kwh FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, station_id)
);

-- 11. Scenario Simulations (for testing)
CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    scenario_type VARCHAR(100), -- 'storm', 'comms_outage', 'equipment_failure'
    severity VARCHAR(50), -- 'low', 'medium', 'high'
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. User Settings & Preferences
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    renewable_priority_percent FLOAT DEFAULT 80,
    max_diesel_per_day_liters FLOAT DEFAULT 500,
    battery_reserve_percent FLOAT DEFAULT 20,
    notification_email VARCHAR(255),
    theme VARCHAR(50) DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_sensor_data_station_time ON sensor_data(station_id, time DESC);
CREATE INDEX idx_energy_generation_station_time ON energy_generation(station_id, time DESC);
CREATE INDEX idx_load_consumption_station_time ON load_consumption(station_id, time DESC);
CREATE INDEX idx_dispatch_station_time ON dispatch_decisions(station_id, timestamp DESC);
CREATE INDEX idx_alerts_station_active ON alerts(station_id, is_active);
CREATE INDEX idx_equipment_health_station ON equipment_health(station_id, status);

-- Views for common queries

-- Current system status
CREATE VIEW v_current_status AS
SELECT 
    s.id,
    s.name,
    eg.solar_kw,
    eg.wind_kw,
    eg.diesel_kw,
    eg.fuel_cell_kw,
    eg.battery_soc,
    lc.total_load_kw,
    (eg.solar_kw + eg.wind_kw + eg.fuel_cell_kw) as renewable_kw,
    eg.time
FROM stations s
LEFT JOIN LATERAL (
    SELECT * FROM energy_generation 
    WHERE station_id = s.id 
    ORDER BY time DESC LIMIT 1
) eg ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM load_consumption 
    WHERE station_id = s.id 
    ORDER BY time DESC LIMIT 1
) lc ON TRUE;

-- Daily performance summary
CREATE VIEW v_daily_performance AS
SELECT 
    date,
    station_id,
    renewable_fraction,
    diesel_consumed_liters,
    co2_emitted_kg,
    uptime_percent,
    energy_generated_kwh,
    energy_consumed_kwh
FROM kpi_daily
ORDER BY date DESC;
