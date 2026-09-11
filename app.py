"""
PolarGrid AI - Flask REST API Backend
Energy Management System for Polar Research Stations
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
import json
from dotenv import load_dotenv
import logging

load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost:5432/polargrid'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

# Initialize database
db = SQLAlchemy(app)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Station(db.Model):
    __tablename__ = 'stations'
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    location = db.Column(db.String(255))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    capacity_kwh = db.Column(db.Float, default=1000)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class EnergySource(db.Model):
    __tablename__ = 'energy_sources'
    id = db.Column(db.String(36), primary_key=True)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    source_type = db.Column(db.String(50))  # solar, wind, diesel, battery, fuel_cell
    capacity_kw = db.Column(db.Float)
    efficiency = db.Column(db.Float, default=0.85)

class SensorData(db.Model):
    __tablename__ = 'sensor_data'
    id = db.Column(db.String(36), primary_key=True)
    time = db.Column(db.DateTime)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    sensor_type = db.Column(db.String(100))
    value = db.Column(db.Float)
    unit = db.Column(db.String(50))

class EnergyGeneration(db.Model):
    __tablename__ = 'energy_generation'
    id = db.Column(db.String(36), primary_key=True)
    time = db.Column(db.DateTime)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    solar_kw = db.Column(db.Float, default=0)
    wind_kw = db.Column(db.Float, default=0)
    diesel_kw = db.Column(db.Float, default=0)
    fuel_cell_kw = db.Column(db.Float, default=0)
    battery_discharge_kw = db.Column(db.Float, default=0)
    battery_soc = db.Column(db.Float)
    battery_health = db.Column(db.Float, default=100)

class LoadConsumption(db.Model):
    __tablename__ = 'load_consumption'
    id = db.Column(db.String(36), primary_key=True)
    time = db.Column(db.DateTime)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    total_load_kw = db.Column(db.Float)
    heating_load_kw = db.Column(db.Float, default=0)
    research_load_kw = db.Column(db.Float, default=0)

class DispatchDecision(db.Model):
    __tablename__ = 'dispatch_decisions'
    id = db.Column(db.String(36), primary_key=True)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    timestamp = db.Column(db.DateTime)
    solar_dispatch_kw = db.Column(db.Float, default=0)
    wind_dispatch_kw = db.Column(db.Float, default=0)
    diesel_dispatch_kw = db.Column(db.Float, default=0)
    battery_dispatch_kw = db.Column(db.Float, default=0)
    fuel_cell_dispatch_kw = db.Column(db.Float, default=0)
    decision_reason = db.Column(db.String(500))
    confidence = db.Column(db.Float)

class Alert(db.Model):
    __tablename__ = 'alerts'
    id = db.Column(db.String(36), primary_key=True)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'))
    alert_type = db.Column(db.String(100))  # critical, warning, info
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

class KpiDaily(db.Model):
    __tablename__ = 'kpi_daily'
    date = db.Column(db.Date, primary_key=True)
    station_id = db.Column(db.String(36), db.ForeignKey('stations.id'), primary_key=True)
    renewable_fraction = db.Column(db.Float)
    diesel_consumed_liters = db.Column(db.Float)
    co2_emitted_kg = db.Column(db.Float)
    uptime_percent = db.Column(db.Float)
    energy_generated_kwh = db.Column(db.Float)
    energy_consumed_kwh = db.Column(db.Float)

# ============================================================================
# ROUTES - STATIONS
# ============================================================================

@app.route('/api/stations', methods=['GET'])
def get_stations():
    """Get all stations"""
    stations = Station.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'location': s.location,
        'capacity_kwh': s.capacity_kwh
    } for s in stations])

@app.route('/api/stations/<station_id>', methods=['GET'])
def get_station(station_id):
    """Get single station details"""
    station = Station.query.get(station_id)
    if not station:
        return jsonify({'error': 'Station not found'}), 404
    
    return jsonify({
        'id': station.id,
        'name': station.name,
        'location': station.location,
        'latitude': station.latitude,
        'longitude': station.longitude,
        'capacity_kwh': station.capacity_kwh
    })

# ============================================================================
# ROUTES - CURRENT STATUS (Real-time)
# ============================================================================

@app.route('/api/stations/<station_id>/current-status', methods=['GET'])
def get_current_status(station_id):
    """Get current energy status (latest values)"""
    
    # Latest energy generation
    energy = EnergyGeneration.query.filter_by(station_id=station_id)\
        .order_by(EnergyGeneration.time.desc()).first()
    
    # Latest load
    load = LoadConsumption.query.filter_by(station_id=station_id)\
        .order_by(LoadConsumption.time.desc()).first()
    
    # Active alerts
    alerts = Alert.query.filter_by(station_id=station_id, is_active=True).all()
    
    # Latest weather
    from sqlalchemy import text
    weather_result = db.session.execute(text(
        "SELECT temperature_c, wind_speed_ms, solar_irradiance_w_m2 FROM weather_forecast "
        "WHERE station_id = :sid ORDER BY time DESC LIMIT 1"
    ), {'sid': station_id}).fetchone()
    
    weather = {
        'temperature': weather_result[0] if weather_result else 0,
        'wind_speed': weather_result[1] if weather_result else 0,
        'solar_irradiance': weather_result[2] if weather_result else 0
    } if weather_result else {}
    
    if not energy or not load:
        return jsonify({'error': 'No data available'}), 404
    
    renewable_kw = energy.solar_kw + energy.wind_kw + energy.fuel_cell_kw
    
    return jsonify({
        'timestamp': energy.time.isoformat(),
        'generation': {
            'solar_kw': energy.solar_kw,
            'wind_kw': energy.wind_kw,
            'diesel_kw': energy.diesel_kw,
            'fuel_cell_kw': energy.fuel_cell_kw,
            'renewable_kw': renewable_kw,
            'total_generation_kw': renewable_kw + energy.diesel_kw
        },
        'battery': {
            'soc_percent': energy.battery_soc,
            'health_percent': energy.battery_health,
            'discharge_kw': energy.battery_discharge_kw
        },
        'load': {
            'total_kw': load.total_load_kw,
            'heating_kw': load.heating_load_kw,
            'research_kw': load.research_load_kw
        },
        'weather': weather,
        'renewable_fraction_percent': (renewable_kw / (renewable_kw + energy.diesel_kw) * 100) if (renewable_kw + energy.diesel_kw) > 0 else 0,
        'active_alerts': len([a for a in alerts if a.is_active]),
        'alerts': [{
            'id': a.id,
            'type': a.alert_type,
            'title': a.title,
            'description': a.description,
            'created_at': a.created_at.isoformat()
        } for a in alerts[:5]]  # Latest 5 alerts
    })

# ============================================================================
# ROUTES - FORECASTING
# ============================================================================

@app.route('/api/stations/<station_id>/forecast', methods=['GET'])
def get_forecast(station_id):
    """Get 24-hour weather & generation forecast"""
    from sqlalchemy import text
    
    hours = int(request.args.get('hours', 24))
    now = datetime.utcnow()
    
    results = db.session.execute(text(
        "SELECT time, temperature_c, wind_speed_ms, solar_irradiance_w_m2 "
        "FROM weather_forecast "
        "WHERE station_id = :sid AND time >= :start AND time <= :end "
        "ORDER BY time"
    ), {
        'sid': station_id,
        'start': now,
        'end': now + timedelta(hours=hours)
    }).fetchall()
    
    forecast_data = [{
        'time': r[0].isoformat(),
        'temperature': r[1],
        'wind_speed': r[2],
        'solar_irradiance': r[3],
        'predicted_solar_kw': max(0, r[3] / 1000 * 50),  # ~50kW capacity
        'predicted_wind_kw': min(100, r[2] ** 2 * 0.5)  # Cubic wind curve
    } for r in results]
    
    return jsonify({
        'forecast_hours': hours,
        'data': forecast_data
    })

# ============================================================================
# ROUTES - AI DISPATCH
# ============================================================================

@app.route('/api/stations/<station_id>/dispatch', methods=['GET'])
def get_dispatch_plan(station_id):
    """Get AI dispatch plan for next 24 hours"""
    from sqlalchemy import text
    
    hours = int(request.args.get('hours', 24))
    now = datetime.utcnow()
    
    results = db.session.execute(text(
        "SELECT timestamp, solar_dispatch_kw, wind_dispatch_kw, diesel_dispatch_kw, "
        "battery_dispatch_kw, fuel_cell_dispatch_kw, decision_reason, confidence "
        "FROM dispatch_decisions "
        "WHERE station_id = :sid AND timestamp >= :start AND timestamp <= :end "
        "ORDER BY timestamp"
    ), {
        'sid': station_id,
        'start': now,
        'end': now + timedelta(hours=hours)
    }).fetchall()
    
    dispatch_data = [{
        'time': r[0].isoformat(),
        'solar': r[1],
        'wind': r[2],
        'diesel': r[3],
        'battery': r[4],
        'fuel_cell': r[5],
        'reason': r[6],
        'confidence': r[7]
    } for r in results]
    
    return jsonify({
        'dispatch_plan': dispatch_data,
        'strategy': 'Solar → Battery → Wind → Fuel Cell → Diesel'
    })

# ============================================================================
# ROUTES - KPIs
# ============================================================================

@app.route('/api/stations/<station_id>/kpis', methods=['GET'])
def get_kpis(station_id):
    """Get KPI data for dashboard"""
    days = int(request.args.get('days', 30))
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    kpis = KpiDaily.query.filter(
        KpiDaily.station_id == station_id,
        KpiDaily.date >= start_date
    ).order_by(KpiDaily.date).all()
    
    if not kpis:
        return jsonify({'error': 'No KPI data'}), 404
    
    latest = kpis[-1]
    
    return jsonify({
        'latest': {
            'renewable_fraction_percent': latest.renewable_fraction * 100,
            'diesel_consumed_liters': latest.diesel_consumed_liters,
            'co2_avoided_kg': latest.co2_emitted_kg,
            'uptime_percent': latest.uptime_percent,
            'energy_generated_kwh': latest.energy_generated_kwh,
            'energy_consumed_kwh': latest.energy_consumed_kwh
        },
        'history': [{
            'date': k.date.isoformat(),
            'renewable_fraction': k.renewable_fraction * 100,
            'diesel_consumed': k.diesel_consumed_liters,
            'co2_emitted': k.co2_emitted_kg,
            'uptime': k.uptime_percent
        } for k in kpis]
    })

# ============================================================================
# ROUTES - ALERTS
# ============================================================================

@app.route('/api/stations/<station_id>/alerts', methods=['GET'])
def get_alerts(station_id):
    """Get all alerts"""
    alerts = Alert.query.filter_by(station_id=station_id)\
        .order_by(Alert.created_at.desc()).all()
    
    return jsonify([{
        'id': a.id,
        'type': a.alert_type,
        'title': a.title,
        'description': a.description,
        'is_active': a.is_active,
        'created_at': a.created_at.isoformat(),
        'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None
    } for a in alerts])

@app.route('/api/stations/<station_id>/alerts', methods=['POST'])
def create_alert(station_id):
    """Create new alert (for simulations)"""
    data = request.get_json()
    
    alert = Alert(
        id=os.urandom(16).hex(),
        station_id=station_id,
        alert_type=data.get('type', 'warning'),
        title=data.get('title'),
        description=data.get('description'),
        is_active=True
    )
    
    db.session.add(alert)
    db.session.commit()
    
    return jsonify({
        'id': alert.id,
        'message': 'Alert created'
    }), 201

@app.route('/api/stations/<station_id>/alerts/<alert_id>/resolve', methods=['POST'])
def resolve_alert(station_id, alert_id):
    """Resolve an alert"""
    alert = Alert.query.filter_by(id=alert_id, station_id=station_id).first()
    if not alert:
        return jsonify({'error': 'Alert not found'}), 404
    
    alert.is_active = False
    alert.resolved_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Alert resolved'})

# ============================================================================
# ROUTES - SCENARIOS (Simulation)
# ============================================================================

@app.route('/api/stations/<station_id>/simulate', methods=['POST'])
def trigger_simulation(station_id):
    """Trigger a scenario simulation (storm, comms outage, etc)"""
    data = request.get_json()
    scenario_type = data.get('type')  # 'storm', 'comms_outage', 'equipment_failure'
    
    if scenario_type == 'storm':
        Alert(
            id=os.urandom(16).hex(),
            station_id=station_id,
            alert_type='critical',
            title='⚠️ SEVERE STORM INCOMING',
            description='Wind speed expected to exceed 80 km/h. Wind turbine offline. Prepare for extended battery operation.',
            is_active=True
        )
    
    elif scenario_type == 'comms_outage':
        Alert(
            id=os.urandom(16).hex(),
            station_id=station_id,
            alert_type='warning',
            title='🚨 COMMUNICATIONS OUTAGE',
            description='Satellite link down. Operating in island mode. AI running on-edge.',
            is_active=True
        )
    
    elif scenario_type == 'equipment_failure':
        Alert(
            id=os.urandom(16).hex(),
            station_id=station_id,
            alert_type='critical',
            title='❌ EQUIPMENT FAILURE DETECTED',
            description='Solar inverter malfunction. Diesel generator activated. Maintenance scheduled.',
            is_active=True
        )
    
    db.session.commit()
    
    return jsonify({
        'scenario': scenario_type,
        'message': 'Simulation triggered',
        'new_alert_status': 'Check dashboard'
    }), 201

# ============================================================================
# ROUTES - HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'PolarGrid AI API',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat()
    })

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f'Internal server error: {error}')
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
