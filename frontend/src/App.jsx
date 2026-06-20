import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- Sub-components for SVG charts and Leaflet maps ---

// 1. CPCB AQI Gauge Arc
function AQIGauge({ aqi }) {
  const val = Math.min(Math.max(parseInt(aqi) || 0, 0), 500);
  const percent = val / 500;
  
  const radius = 45;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent * circ);
  
  let color = 'var(--accent-green)';
  if (val <= 50) color = 'var(--accent-green)';
  else if (val <= 100) color = '#84cc16'; // Satisfactory (light green)
  else if (val <= 200) color = 'var(--accent-yellow)';
  else if (val <= 300) color = 'var(--accent-orange)';
  else if (val <= 400) color = 'var(--accent-red)';
  else color = '#7f1d1d'; // Severe

  return (
    <div className="aqi-gauge">
      <svg viewBox="0 0 110 110" width="100%" height="100%">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="8"/>
        <circle cx="55" cy="55" r={radius} fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}/>
        <text x="55" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="20px" fontWeight="800" fontFamily="'Outfit', sans-serif">{val}</text>
        <text x="55" y="72" textAnchor="middle" fill={color} fontSize="8px" fontWeight="700" letterSpacing="0.5px">INDIAN CPCB</text>
      </svg>
    </div>
  );
}

// 2. Sunrise & Sunset Arc
function SunriseSunsetArc({ sunriseStr, sunsetStr }) {
  function timeToMin(time) {
    if (!time) return 0;
    const parts = time.trim().split(/\s+/);
    if (parts.length < 2) return 0;
    const [timeVal, modifier] = parts;
    let [hours, minutes] = timeVal.split(':');
    hours = parseInt(hours) || 0;
    minutes = parseInt(minutes) || 0;
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const sunriseMin = timeToMin(sunriseStr);
  const sunsetMin = timeToMin(sunsetStr);
  
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let pct = 0;
  if (currentMin >= sunriseMin && currentMin <= sunsetMin) {
    pct = (currentMin - sunriseMin) / (sunsetMin - sunriseMin);
  } else if (currentMin > sunsetMin) {
    pct = 1;
  } else {
    pct = 0;
  }

  const w = 240;
  const h = 100;
  const rx = 100;
  const ry = 70;
  const cx = w / 2;
  const cy = h - 10;

  const angle = 180 - (pct * 180);
  const rad = angle * Math.PI / 180;
  const sunX = cx + rx * Math.cos(rad);
  const sunY = cy - ry * Math.sin(rad);

  return (
    <div className="sun-arc-wrapper">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-orange)"/>
            <stop offset="50%" stopColor="var(--accent-yellow)"/>
            <stop offset="100%" stopColor="var(--accent-red)"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4,4" strokeWidth="2"/>
        <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${sunX} ${sunY}`} fill="none" stroke="url(#arcGrad)" strokeWidth="2.5"/>
        <line x1="10" y1={cy} x2={w - 10} y2={cy} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
        <circle cx={sunX} cy={sunY} r="8" fill="var(--accent-yellow)" filter="url(#glow)"/>
      </svg>
    </div>
  );
}

// 3. Hourly Temperature Smooth Curve SVG
function HourlyForecastChart({ hourlyData }) {
  if (!hourlyData || hourlyData.length === 0) return null;

  const temps = hourlyData.map(item => item.temp);
  const max = Math.max(...temps);
  const min = Math.min(...temps);
  const range = max - min || 1;

  const width = 800;
  const height = 150;
  const padding = 40;

  const points = hourlyData.map((item, idx) => {
    const x = padding + (idx * (width - 2 * padding) / (hourlyData.length - 1 || 1));
    const y = height - padding - ((item.temp - min) / range * (height - 2 * padding));
    return { x, y, temp: item.temp, time: item.time };
  });

  // Smooth cubic bezier line definition
  let lineD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cp1x = p1.x + (p2.x - p1.x) / 3;
    const cp1y = p1.y;
    const cp2x = p1.x + 2 * (p2.x - p1.x) / 3;
    const cp2y = p2.y;
    lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // Shadow fill under curve
  let areaD = `M ${points[0].x} ${height - padding}`;
  points.forEach(p => {
    areaD += ` L ${p.x} ${p.y}`;
  });
  areaD += ` L ${points[points.length - 1].x} ${height - padding} Z`;

  return (
    <div className="hourly-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#chartGrad)"/>
        <path d={lineD} fill="none" stroke="var(--accent-blue)" strokeWidth="3"/>
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--text-primary)" stroke="var(--accent-blue)" strokeWidth="2"/>
            <text x={p.x} y={p.y - 12} textAnchor="middle" fill="var(--text-primary)" fontSize="11px" fontWeight="700">{p.temp}°</text>
            <text x={p.x} y={height - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="10px" fontWeight="500">{p.time}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// 4. Interactive Weather Map
function WeatherMap({ weatherMaps, city, activeMapLayer, onLayerChange }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const weatherLayerRef = useRef(null);

  useEffect(() => {
    if (!weatherMaps) return;
    const { lat, lon } = weatherMaps;

    // Wait until DOM element is loaded and Leaflet is available in global scope
    if (!window.L) return;

    if (!mapInstanceRef.current) {
      const m = window.L.map('weather-map-full-react', { scrollWheelZoom: false }).setView([lat, lon], 7);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(m);
      mapInstanceRef.current = m;
    } else {
      mapInstanceRef.current.setView([lat, lon], 7);
    }

    const m = mapInstanceRef.current;

    if (markerRef.current) {
      m.removeLayer(markerRef.current);
    }
    markerRef.current = window.L.marker([lat, lon]).addTo(m)
      .bindPopup(`<b>${city}</b><br>Currently showing weather.`)
      .openPopup();

    setTimeout(() => {
      m.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [weatherMaps, city]);

  useEffect(() => {
    const m = mapInstanceRef.current;
    if (!m || !weatherMaps) return;
    const { api_key } = weatherMaps;

    if (weatherLayerRef.current) {
      m.removeLayer(weatherLayerRef.current);
    }

    const layerUrls = {
      clouds: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${api_key}`,
      precipitation: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${api_key}`,
      wind: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${api_key}`
    };

    const newLayer = window.L.tileLayer(layerUrls[activeMapLayer], {
      attribution: '© OpenWeatherMap',
      opacity: 0.65
    });
    newLayer.addTo(m);
    weatherLayerRef.current = newLayer;
  }, [activeMapLayer, weatherMaps]);

  const layerNames = {
    clouds: 'Clouds',
    precipitation: 'Precipitation/Rain',
    wind: 'Wind speed'
  };

  return (
    <div className="map-view-fullscreen">
      <div className="map-header-bar">
        <h3 className="map-title">
          <i className="fas fa-map"></i> Weather Map Cockpit
        </h3>
        <div className="map-layer-selector">
          <button 
            className={`layer-btn ${activeMapLayer === 'clouds' ? 'active' : ''}`} 
            onClick={() => onLayerChange('clouds')}
          >
            Clouds
          </button>
          <button 
            className={`layer-btn ${activeMapLayer === 'precipitation' ? 'active' : ''}`} 
            onClick={() => onLayerChange('precipitation')}
          >
            Rain/Precipitation
          </button>
          <button 
            className={`layer-btn ${activeMapLayer === 'wind' ? 'active' : ''}`} 
            onClick={() => onLayerChange('wind')}
          >
            Wind speed
          </button>
        </div>
      </div>
      <div id="weather-map-full-react" ref={mapContainerRef} style={{ width: '100%', height: '580px', borderRadius: '24px', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)', zIndex: 10 }}></div>
      <div className="map-legend-banner">
        Showing: {layerNames[activeMapLayer]} layer
      </div>
    </div>
  );
}

// --- Main App SPA Container ---
function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [activeMapLayer, setActiveMapLayer] = useState('clouds');

  // Interactive collapsibles
  const [activeForecastDay, setActiveForecastDay] = useState('');
  const [expandedHourlyCardId, setExpandedHourlyCardId] = useState(null);

  // Global settings/listeners
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // PWA Prompts
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  const searchInputRef = useRef(null);

  // --- Fetch API Weather Report ---
  const fetchWeather = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const urlParams = new URLSearchParams();
      if (params.city) {
        urlParams.append('city', params.city);
      } else if (params.lat && params.lon) {
        urlParams.append('lat', params.lat);
        urlParams.append('lon', params.lon);
      } else {
        // Fallback default
        urlParams.append('city', 'Mumbai');
      }

      const response = await fetch(`/api/weather/?${urlParams.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setWeatherData(data);
        // Default collapsible expanded to first day
        if (data.forecast && data.forecast.length > 0) {
          setActiveForecastDay(data.forecast[0].date);
        }
      } else {
        setError(data.error || 'Failed to retrieve weather reports.');
        setWeatherData(null);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while connecting to the weather service.');
      setWeatherData(null);
    } finally {
      setLoading(false);
    }
  };

  // --- Lifecycle Initializations ---
  useEffect(() => {
    // 1. Initial Geolocation/Search Check from URL params
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get('city');
    const latParam = params.get('lat');
    const lonParam = params.get('lon');

    if (cityParam) {
      fetchWeather({ city: cityParam });
      setSearchQuery(cityParam);
    } else if (latParam && lonParam) {
      fetchWeather({ lat: latParam, lon: lonParam });
    }

    // 2. Offline Status Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. PWA Setup
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPwaBanner(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('PWA Service Worker registered at scope:', reg.scope))
        .catch((err) => console.error('PWA Service Worker registration failed:', err));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // --- Theme toggles ---
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Calculations ---

  // Group forecasts by day name
  const groupedForecast = useMemo(() => {
    if (!weatherData || !weatherData.forecast) return {};
    const grouped = {};
    weatherData.forecast.forEach(item => {
      const dayKey = item.date;
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(item);
    });
    return grouped;
  }, [weatherData]);

  // Forecast points for the active chart
  const activeForecastTimelineItems = useMemo(() => {
    return groupedForecast[activeForecastDay] || [];
  }, [groupedForecast, activeForecastDay]);

  // AI insights & suggestions (CPCB custom conversions)
  const aiInsight = useMemo(() => {
    if (!weatherData || !weatherData.current_weather) {
      return {
        text: "Loading AI insights and suggestions for your day...",
        gear: {
          water: { status: 'recommended', desc: 'Recommended: Stay hydrated with standard daily intake.' },
          sunscreen: { status: 'optional', desc: 'Optional: Low UV index levels today.' },
          sunglasses: { status: 'optional', desc: 'Optional: Standard cloud coverage.' }
        }
      };
    }
    const current = weatherData.current_weather;
    const temp = current.temperature;
    const desc = current.description.toLowerCase();
    const uvi = weatherData.uv_index ? weatherData.uv_index.value : 0;
    const aqiVal = weatherData.air_quality ? weatherData.air_quality.aqi : null;

    let text = "";
    
    // Default gear configurations
    let gear = {
      water: { status: 'recommended', desc: 'Drink at least 2-3 liters of water to maintain high energy.' },
      sunscreen: { status: 'optional', desc: 'Low UV index today. Sun protection is optional.' },
      sunglasses: { status: 'optional', desc: 'Subtle light glare protection recommended.' }
    };

    // Calculate temperatures, weather details and update items
    if (temp > 35) {
      text = "Extreme temperature alert. It's hot outside! Stay hydrated with electrolyte water, seek shade, and avoid prolonged outdoor activity between 11 AM and 4 PM.";
      gear.water = { status: 'critical', desc: 'Critical: High heat! Carry electrolyte water and drink hourly.' };
      gear.sunscreen = { status: 'critical', desc: 'Critical: Apply SPF 50+ sunscreen. Heavy heat exposure.' };
      gear.sunglasses = { status: 'recommended', desc: 'Recommended: UV400 sunglasses to protect from solar glare.' };
    } else if (temp > 30) {
      text = "High temperature alert. It's hot outside! Stay hydrated with electrolyte water, seek shade, and avoid prolonged outdoor activity between 11 AM and 4 PM.";
      gear.water = { status: 'recommended', desc: 'Recommended: Warm temperature. Keep drinking water regularly.' };
      if (uvi >= 3) {
        gear.sunscreen = { status: 'recommended', desc: 'Recommended: Apply SPF 30+ sunscreen. Moderate UV Index.' };
      }
      gear.sunglasses = { status: 'recommended', desc: 'Recommended: Shield eyes from sun glare.' };
    } else if (temp < 15) {
      text = "Chilly conditions reported. We recommend layering your clothing to stay warm. Keep your throat covered to prevent seasonal colds.";
      gear.water = { status: 'optional', desc: 'Optional: Warm beverages and herbal teas are recommended.' };
      gear.sunscreen = { status: 'optional', desc: 'Minimal solar intensity. Sunscreen optional.' };
      gear.sunglasses = { status: 'optional', desc: 'Low UV index. Glasses optional.' };
    } else if (desc.includes("rain") || desc.includes("storm") || desc.includes("drizzle")) {
      text = "Rainy conditions active. Roadways may be slippery. Keep an umbrella handy, wear water-resistant shoes, and limit physical activity outdoors.";
      gear.umbrella = { status: 'critical', desc: 'Critical: Heavy rain/storm alert. Carry an umbrella.' };
    } else {
      text = "Pleasant weather conditions. Great day for outdoor walks or exercises. Keep hydrated as standard practice.";
    }

    // Check UV index thresholds specifically
    if (uvi >= 6) {
      gear.sunscreen = { status: 'critical', desc: `Critical: Very High UV (${uvi}). SPF 50+ block is required.` };
      gear.sunglasses = { status: 'critical', desc: 'Critical: Shield eyes against intense UV rays.' };
    } else if (uvi >= 3 && gear.sunscreen.status !== 'recommended') {
      gear.sunscreen = { status: 'recommended', desc: `Recommended: Moderate UV (${uvi}). Apply sunscreen.` };
      gear.sunglasses = { status: 'recommended', desc: 'Recommended: Protect eyes from sunlight.' };
    }

    if (aqiVal !== null) {
      if (aqiVal > 200) {
        text += ` Poor air quality alert (AQI: ${aqiVal} on CPCB scale). Avoid morning runs or outdoor workouts. Wearing an N95 mask is strongly advised.`;
        gear.mask = { status: 'critical', desc: `Critical: Unhealthy AQI (${aqiVal}). N95 mask is mandatory.` };
      } else if (aqiVal > 100) {
        text += " Moderate air pollution is active. Sensitive individuals should monitor respiratory symptoms.";
        gear.mask = { status: 'recommended', desc: `Recommended: Moderate AQI (${aqiVal}). Sensitive groups wear masks.` };
      }
    }

    return { text, gear };
  }, [weatherData]);

  // Active Alert banners mapping (Moved to top UX)
  const activeAlerts = useMemo(() => {
    if (!weatherData || !weatherData.current_weather) return [];
    const current = weatherData.current_weather;
    const temp = current.temperature;
    const desc = current.description.toLowerCase();
    const aqiVal = weatherData.air_quality ? weatherData.air_quality.aqi : null;

    const alerts = [];

    if (aqiVal !== null && aqiVal > 150) {
      alerts.push({
        id: 'pollution-alert',
        type: 'warning',
        icon: 'fa-smog',
        title: `Pollution Warning (CPCB: ${aqiVal})`,
        message: 'Air quality index is unhealthy. Sensitive groups should stay indoors and wear masks.'
      });
    }

    if (temp > 35) {
      alerts.push({
        id: 'heat-alert',
        type: 'warning',
        icon: 'fa-temperature-arrow-up',
        title: 'Extreme Heat warning',
        message: `High temperature of ${temp}°C. Reduce heat exposure and drink plenty of fluids.`
      });
    }

    if (desc.includes("thunder") || desc.includes("heavy rain") || desc.includes("shower")) {
      alerts.push({
        id: 'storm-alert',
        type: 'warning',
        icon: 'fa-cloud-showers-heavy',
        title: 'Severe Rain / Storm Warning',
        message: 'Thunderstorm activity or heavy downpours active. Limit outdoor travels.'
      });
    }

    return alerts;
  }, [weatherData]);

  // --- Handlers ---
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchWeather({ city: searchQuery.trim() });
      setActiveTab('home');
    }
  };

  const handleGPSLocation = () => {
    if (navigator.geolocation) {
      fetchWeather({ lat: 0, lon: 0 }); // Placeholder to reset loading state
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather({ lat: latitude, lon: longitude });
          setActiveTab('home');
        },
        (err) => {
          alert(`Geolocation error: ${err.message}`);
          fetchWeather(); // Fetch default again
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const speakWeatherReport = () => {
    if (!weatherData) return;
    const current = weatherData.current_weather;
    const aqi = weatherData.air_quality;
    const city = weatherData.city;
    
    let report = '';
    if (current) {
      report += `The current weather in ${city} is ${current.badge?.label} and ${current.description}. `;
      report += `The temperature is ${current.temperature} degrees Celsius, but it feels like ${current.real_feel} degrees. `;
      report += `Humidity levels are at ${current.humidity} percent, and the wind is blowing at ${current.wind_speed} meters per second. `;
    }
    if (aqi) {
      report += `The Air Quality Index is ${aqi.aqi}, calculated on the CPCB Indian scale, categorised as ${aqi.category}. `;
    }
    if (report === '') {
      report = "Welcome to KnoxyView. Please enter a city to read your weather report.";
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(report);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User installed the weather companion app');
        }
        setDeferredPrompt(null);
        setShowPwaBanner(false);
      });
    }
  };

  const focusSearchInput = () => {
    setActiveTab('home');
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSection = (sectionId) => {
    setActiveTab('home');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  return (
    <>
      {/* Mobile Header (Hidden on Desktop) */}
      <header className="mobile-header">
        <div className="sidebar-brand">
          <img className="brand-logo" src="/static/weather/images/logo.svg" alt="KnoxyView Logo" />
          <span className="brand-name">KnoxyView</span>
        </div>
        <button className="action-icon-btn" onClick={() => setActiveTab('settings')} aria-label="Settings">
          <i className="fas fa-cog"></i>
        </button>
      </header>

      {/* App Main Layout */}
      <div className="app-layout">
        
        {/* Sidebar Navigation (Desktop) - Profile Card Completely Removed */}
        <aside className="sidebar">
          <div>
            <div className="sidebar-brand">
              <img className="brand-logo" src="/static/weather/images/logo.svg" alt="KnoxyView Logo" />
              <span className="brand-name">KnoxyView</span>
            </div>
            <div className="brand-subtitle">AI Powered Weather Companion</div>
            
            <ul className="sidebar-menu">
              <li className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} id="side-menu-home">
                <a onClick={() => { setActiveTab('home'); scrollToTop(); }}><i className="fas fa-home"></i> Home</a>
              </li>
              <li className="menu-item">
                <a onClick={focusSearchInput}><i className="fas fa-search"></i> Search</a>
              </li>
              <li className={`menu-item ${activeTab === 'map' ? 'active' : ''}`} id="side-menu-map">
                <a onClick={() => { setActiveTab('map'); scrollToTop(); }}><i className="fas fa-map"></i> Map cockpit</a>
              </li>
              <li className="menu-item">
                <a onClick={() => navigateToSection('aqi-card-section')}><i className="fas fa-leaf"></i> Air Quality</a>
              </li>
              <li className="menu-item">
                <a onClick={() => navigateToSection('alerts-card-section')}><i className="fas fa-bell"></i> Alerts</a>
              </li>
              <li className="menu-item">
                <a onClick={() => alert('Saved Places panel toggled!')}><i className="fas fa-bookmark"></i> Saved Places</a>
              </li>
              <li className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} id="side-menu-settings">
                <a onClick={() => { setActiveTab('settings'); scrollToTop(); }}><i className="fas fa-cog"></i> Settings</a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          
          {/* Main Header / Search section */}
          <header className="main-header">
            <div className="search-container">
              <form onSubmit={handleSearch} className="search-form">
                <i className="fas fa-search" style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}></i>
                <input 
                  type="text" 
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city or location..." 
                  required 
                  className="search-input" 
                />
                <button type="submit" className="search-btn"><i className="fas fa-arrow-right"></i></button>
              </form>
            </div>
            
            <div className="header-actions">
              <button className="action-icon-btn" onClick={handleGPSLocation} title="Get GPS Location">
                <i className="fas fa-location-dot"></i>
              </button>
              <button 
                className="action-icon-btn" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                title="Toggle Light/Dark Theme"
              >
                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
              <button className="action-icon-btn" onClick={speakWeatherReport} title="Read Weather Report">
                <i className="fas fa-volume-up"></i>
              </button>
            </div>
          </header>

          {/* Loading spinner overlay */}
          {loading && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', gap: '16px', marginBottom: '32px' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: 'var(--accent-blue)' }}></i>
              <h4 style={{ fontFamily: 'Outfit', fontSize: '1.25rem' }}>Fetching real-time weather logs...</h4>
            </div>
          )}

          {/* Error Alert Box */}
          {error && !loading && (
            <section className="glass-card" style={{ textAlign: 'center', padding: '80px 40px', marginBottom: '32px' }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: '3rem', color: 'var(--accent-red)', marginBottom: '20px' }}></i>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: 700 }}>Location Not Found</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{error}</p>
            </section>
          )}

          {/* --- TAB SWITCHING LOGIC --- */}

          {/* Tab 1: Home Dashboard View */}
          {activeTab === 'home' && !loading && !error && (
            <div id="view-home" className="dashboard-view">
              {weatherData && weatherData.current_weather ? (
                <>
                  {/* UX Requirement: Weather Alerts repositioned to the very top right below header */}
                  <section className="glass-card alerts-card" id="alerts-card-section" style={{ marginBottom: '32px' }}>
                    <h3 className="card-title" style={{ marginBottom: '16px' }}>
                      <i className="fas fa-triangle-exclamation" style={{ color: 'var(--accent-red)' }}></i> Weather Alerts
                    </h3>
                    <div className="alerts-list">
                      {activeAlerts.length > 0 ? (
                        activeAlerts.map(alertItem => (
                          <div key={alertItem.id} className="alert-box">
                            <div className="alert-icon"><i className={`fas ${alertItem.icon}`}></i></div>
                            <div className="alert-content">
                              <h4>{alertItem.title}</h4>
                              <p>{alertItem.message}</p>
                              <span className="alert-time">Active now</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="alert-box info">
                          <div className="alert-icon"><i className="fas fa-circle-check"></i></div>
                          <div className="alert-content">
                            <h4>Conditions Normal</h4>
                            <p>No active weather warnings are reported for this area. It's safe to step out.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Row 1: Weather Info & Today's Insight */}
                  <div className="weather-grid-main">
                    {/* Current Weather Primary Card */}
                    <section className="glass-card weather-card">
                      <div className="card-location">
                        <div className="location-info">
                          <h2>{weatherData.city}</h2>
                          <p>{weatherData.day}, {weatherData.date}</p>
                        </div>
                        <div className="weather-desc-badge">
                          <span className={`badge-pill ${weatherData.current_weather.badge?.type || 'clear'}`}>
                            <i className={`fas ${weatherData.current_weather.badge?.icon || 'fa-sun'}`}></i>
                            {weatherData.current_weather.badge?.label}
                          </span>
                        </div>
                      </div>

                      <div className="weather-main-section">
                        <div className="temp-display">
                          <span className="temp-val">{weatherData.current_weather.temperature}</span>
                          <span className="temp-unit">°C</span>
                        </div>
                        <div className="weather-icon-large">
                          <img 
                            src={`https://openweathermap.org/img/wn/${weatherData.current_weather.icon}@4x.png`} 
                            alt="Weather Status Icon" 
                            style={{ width: '130px', height: '130px', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="temp-minmax">
                          {weatherData.current_weather.description}
                        </div>
                        
                        {/* Detailed metrics grid */}
                        <div className="quick-stats-grid">
                          <div className="quick-stat-item">
                            <div className="quick-stat-icon"><i className="fas fa-thermometer-half"></i></div>
                            <div className="quick-stat-info">
                              <p>Feels Like</p>
                              <h4>{weatherData.current_weather.real_feel}°C</h4>
                            </div>
                          </div>
                          <div className="quick-stat-item">
                            <div className="quick-stat-icon"><i className="fas fa-tint"></i></div>
                            <div className="quick-stat-info">
                              <p>Humidity</p>
                              <h4>{weatherData.current_weather.humidity}%</h4>
                            </div>
                          </div>
                          <div className="quick-stat-item">
                            <div className="quick-stat-icon"><i className="fas fa-wind"></i></div>
                            <div className="quick-stat-info">
                              <p>Wind speed</p>
                              <h4>{weatherData.current_weather.wind_speed} m/s ({weatherData.current_weather.wind_direction})</h4>
                            </div>
                          </div>
                          <div className="quick-stat-item">
                            <div className="quick-stat-icon"><i className="fas fa-compress-alt"></i></div>
                            <div className="quick-stat-info">
                              <p>Pressure</p>
                              <h4>{weatherData.current_weather.pressure} hPa</h4>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Today's Insight Card */}
                    <section className="glass-card insight-card">
                      <div>
                        <h3 className="card-title">
                          <i className="fas fa-star"></i> Today's Insight
                        </h3>
                        <p className="insight-text" id="insight-description">
                          {aiInsight.text}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="recommendations-title">Recommended Gear</h4>
                        <div className="recommended-items">
                          {aiInsight.gear.water && (
                            <div className={`rec-item ${aiInsight.gear.water.status === 'critical' ? 'critical-glow' : ''}`}>
                              <div className="rec-item-icon-wrapper" style={{ 
                                color: aiInsight.gear.water.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-blue)',
                                background: aiInsight.gear.water.status === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(96, 165, 250, 0.1)'
                              }}>
                                <i className="fas fa-bottle-water"></i>
                              </div>
                              <div className="rec-item-content">
                                <div className="rec-item-header">
                                  <span className="rec-item-title">Water & Hydration</span>
                                  <span className={`rec-status-badge ${aiInsight.gear.water.status}`}>
                                    {aiInsight.gear.water.status}
                                  </span>
                                </div>
                                <p className="rec-item-desc">{aiInsight.gear.water.desc}</p>
                              </div>
                            </div>
                          )}

                          {aiInsight.gear.sunscreen && (
                            <div className={`rec-item ${aiInsight.gear.sunscreen.status === 'critical' ? 'critical-glow' : ''}`}>
                              <div className="rec-item-icon-wrapper" style={{ 
                                color: aiInsight.gear.sunscreen.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)',
                                background: aiInsight.gear.sunscreen.status === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)'
                              }}>
                                <i className="fas fa-sun"></i>
                              </div>
                              <div className="rec-item-content">
                                <div className="rec-item-header">
                                  <span className="rec-item-title">Sunscreen Protection</span>
                                  <span className={`rec-status-badge ${aiInsight.gear.sunscreen.status}`}>
                                    {aiInsight.gear.sunscreen.status}
                                  </span>
                                </div>
                                <p className="rec-item-desc">{aiInsight.gear.sunscreen.desc}</p>
                              </div>
                            </div>
                          )}

                          {aiInsight.gear.sunglasses && (
                            <div className={`rec-item ${aiInsight.gear.sunglasses.status === 'critical' ? 'critical-glow' : ''}`}>
                              <div className="rec-item-icon-wrapper" style={{ 
                                color: aiInsight.gear.sunglasses.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-blue)',
                                background: aiInsight.gear.sunglasses.status === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(96, 165, 250, 0.1)'
                              }}>
                                <i className="fas fa-glasses"></i>
                              </div>
                              <div className="rec-item-content">
                                <div className="rec-item-header">
                                  <span className="rec-item-title">UV Sunglasses</span>
                                  <span className={`rec-status-badge ${aiInsight.gear.sunglasses.status}`}>
                                    {aiInsight.gear.sunglasses.status}
                                  </span>
                                </div>
                                <p className="rec-item-desc">{aiInsight.gear.sunglasses.desc}</p>
                              </div>
                            </div>
                          )}

                          {aiInsight.gear.umbrella && (
                            <div className="rec-item critical-glow">
                              <div className="rec-item-icon-wrapper" style={{ color: 'var(--accent-orange)', background: 'rgba(249, 115, 22, 0.1)' }}>
                                <i className="fas fa-umbrella"></i>
                              </div>
                              <div className="rec-item-content">
                                <div className="rec-item-header">
                                  <span className="rec-item-title">Umbrella</span>
                                  <span className="rec-status-badge critical">Critical</span>
                                </div>
                                <p className="rec-item-desc">{aiInsight.gear.umbrella.desc}</p>
                              </div>
                            </div>
                          )}

                          {aiInsight.gear.mask && (
                            <div className={`rec-item ${aiInsight.gear.mask.status === 'critical' ? 'critical-glow' : ''}`}>
                              <div className="rec-item-icon-wrapper" style={{ 
                                color: aiInsight.gear.mask.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)',
                                background: aiInsight.gear.mask.status === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)'
                              }}>
                                <i className="fas fa-mask-face"></i>
                              </div>
                              <div className="rec-item-content">
                                <div className="rec-item-header">
                                  <span className="rec-item-title">N95 Mask</span>
                                  <span className={`rec-status-badge ${aiInsight.gear.mask.status}`}>
                                    {aiInsight.gear.mask.status}
                                  </span>
                                </div>
                                <p className="rec-item-desc">{aiInsight.gear.mask.desc}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Row 2: Air Quality Index, Hourly Chart, Sunrise & Sunset */}
                  <div className="dashboard-grid">
                    {/* AQI CPCB Scale Card */}
                    <section className="glass-card aqi-container" id="aqi-card-section">
                      <h3 className="card-title" style={{ marginBottom: '20px', alignSelf: 'flex-start', width: '100%', justifyContent: 'flex-start' }}>
                        <i className="fas fa-leaf" style={{ color: 'var(--accent-green)' }}></i> Air Quality
                      </h3>
                      {weatherData.air_quality ? (
                        <>
                          <AQIGauge aqi={weatherData.air_quality.aqi} />
                          <div className="aqi-status">
                            {weatherData.air_quality.category}
                          </div>
                          <p className="aqi-desc">
                            {weatherData.air_quality.message}
                          </p>
                          
                          <div className="aqi-pollutants-summary">
                            {weatherData.air_quality.pollutants?.pm25 !== undefined && (
                              <div className="aqi-pollutant-badge">PM2.5: <strong>{weatherData.air_quality.pollutants.pm25}</strong></div>
                            )}
                            {weatherData.air_quality.pollutants?.pm10 !== undefined && (
                              <div className="aqi-pollutant-badge">PM10: <strong>{weatherData.air_quality.pollutants.pm10}</strong></div>
                            )}
                            {weatherData.air_quality.pollutants?.no2 !== undefined && (
                              <div className="aqi-pollutant-badge">NO2: <strong>{weatherData.air_quality.pollutants.no2}</strong></div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', marginTop: '40px' }}>Air quality logs unavailable for this sector.</p>
                      )}
                    </section>

                    {/* Hourly Forecast Chart Card */}
                    <section className="glass-card hourly-card">
                      <div className="hourly-header">
                        <h3 className="card-title" style={{ marginBottom: 0 }}>
                          <i className="fas fa-clock" style={{ color: 'var(--accent-blue)' }}></i> Hourly Forecast ({activeForecastDay.split(',')[0]})
                        </h3>
                      </div>
                      <HourlyForecastChart hourlyData={activeForecastTimelineItems} />
                    </section>

                    {/* Sunrise & Sunset Arc Card */}
                    <section className="glass-card sun-card">
                      <h3 className="card-title">
                        <i className="fas fa-sun" style={{ color: 'var(--accent-yellow)' }}></i> Sunrise & Sunset
                      </h3>
                      <SunriseSunsetArc 
                        sunriseStr={weatherData.current_weather.sunrise} 
                        sunsetStr={weatherData.current_weather.sunset} 
                      />
                      <div className="sun-times">
                        <div className="sun-time-block">
                          <p>Sunrise</p>
                          <h5>{weatherData.current_weather.sunrise}</h5>
                        </div>
                        <div className="sun-time-block">
                          <p>Sunset</p>
                          <h5>{weatherData.current_weather.sunset}</h5>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Row 3: 5-Day Forecast (Now spans full width since Alerts moved to top) */}
                  <div className="bottom-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <section className="glass-card">
                      <h3 className="card-title" style={{ marginBottom: '24px' }}>
                        <i className="fas fa-calendar-alt" style={{ color: 'var(--accent-blue)' }}></i> 5-Day Forecast
                      </h3>
                      <div className="forecast-list">
                        {Object.keys(groupedForecast).map((dayKey, idx) => {
                          const items = groupedForecast[dayKey];
                          const temps = items.map(it => it.temp);
                          const high = Math.max(...temps);
                          const low = Math.min(...temps);
                          const avgRain = Math.round(items.reduce((acc, it) => acc + (it.rain_chance || 0), 0) / items.length);
                          const mainIcon = items[0].icon;
                          const isExpanded = activeForecastDay === dayKey;

                          return (
                            <div key={dayKey} className={`forecast-row ${isExpanded ? 'active' : ''}`}>
                              <div className="forecast-row-header" onClick={() => {
                                setActiveForecastDay(isExpanded ? '' : dayKey);
                              }}>
                                <div className="forecast-row-day">
                                  <img src={`https://openweathermap.org/img/wn/${mainIcon}@2x.png`} alt="Forecast Icon" className="forecast-icon" />
                                  <div>
                                    <div className="day-name">{dayKey.split(',')[0]}</div>
                                    <div className="day-date">{dayKey.split(',')[1] || ''}</div>
                                  </div>
                                </div>
                                <div className="forecast-row-temps">
                                  {avgRain > 15 && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600, marginRight: '8px' }}>
                                      <i className="fas fa-cloud-showers-heavy"></i> {avgRain}%
                                    </span>
                                  )}
                                  <span className="temp-high">{high}°</span>
                                  <span className="temp-low">{low}°</span>
                                  <i className="fas fa-chevron-down forecast-row-toggle"></i>
                                </div>
                              </div>
                              
                              {/* Hourly scrollable details nested inside row */}
                              <div className="forecast-timeline" style={{ maxHeight: isExpanded ? '250px' : '0' }}>
                                <div className="timeline-scroll">
                                  {items.map((it, hidx) => {
                                    const itemId = `${dayKey}-${hidx}`;
                                    const isHourlyCardExpanded = expandedHourlyCardId === itemId;

                                    return (
                                      <div 
                                        key={itemId} 
                                        className={`hourly-item-card ${isHourlyCardExpanded ? 'expanded' : ''}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedHourlyCardId(isHourlyCardExpanded ? null : itemId);
                                        }}
                                      >
                                        <span className="hour-time">{it.time}</span>
                                        <img src={`https://openweathermap.org/img/wn/${it.icon}.png`} alt="Hour icon" className="hour-icon" />
                                        <span className="hour-temp">{it.temp}°</span>
                                        <span className="hour-humidity"><i className="fas fa-tint"></i> {it.humidity}%</span>
                                        {isHourlyCardExpanded && (
                                          <div className="hour-expanded-details">
                                            <div className="expanded-row"><span>Wind</span><strong>{it.wind_speed} m/s</strong></div>
                                            <div className="expanded-row"><span>Clouds</span><strong>{it.clouds}%</strong></div>
                                            <div className="expanded-row"><span>Barom</span><strong>{it.pressure} hPa</strong></div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                /* Welcome onboarding Landing Page */
                <section className="glass-card" style={{ textAlign: 'center', padding: '100px 40px' }}>
                  <i className="fas fa-cloud-sun-rain" style={{ fontSize: '4.5rem', color: 'var(--accent-blue)', marginBottom: '24px', filter: 'drop-shadow(0 8px 16px rgba(96, 165, 250, 0.3))' }}></i>
                  <h2 style={{ fontFamily: 'Outfit', fontSize: '2.2rem', fontWeight: 800 }}>Welcome to KnoxyView</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '12px auto 32px', lineHeight: 1.6 }}>Search for a city above, or tap the locator button to view real-time meteorological indexes, Indian Standard AQIs, and predictive overlays.</p>
                  <button className="back-to-top-btn" onClick={focusSearchInput} style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700 }}>
                    Get Started <i className="fas fa-arrow-right" style={{ marginLeft: '8px' }}></i>
                  </button>
                </section>
              )}
            </div>
          )}

          {/* Tab 2: Map Cockpit Full View */}
          {activeTab === 'map' && (
            <div id="view-map" className="dashboard-view">
              {weatherData && weatherData.weather_maps ? (
                <WeatherMap 
                  weatherMaps={weatherData.weather_maps} 
                  city={weatherData.city} 
                  activeMapLayer={activeMapLayer} 
                  onLayerChange={setActiveMapLayer} 
                />
              ) : (
                <section className="glass-card" style={{ textAlign: 'center', padding: '80px 40px' }}>
                  <i className="fas fa-map-location-dot" style={{ fontSize: '3rem', color: 'var(--accent-blue)', marginBottom: '16px' }}></i>
                  <h4 style={{ fontFamily: 'Outfit', fontSize: '1.25rem' }}>Weather Map Unavailable</h4>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Search for a valid city location to load the interactive cockpit.</p>
                </section>
              )}
            </div>
          )}

          {/* Tab 3: Settings View */}
          {activeTab === 'settings' && (
            <div id="view-settings" className="dashboard-view">
              <section className="glass-card">
                <h3 className="card-title" style={{ marginBottom: '24px' }}>
                  <i className="fas fa-sliders" style={{ color: 'var(--accent-blue)' }}></i> Settings & Accessibility
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <h4 style={{ fontFamily: 'Outfit', fontSize: '1.05rem' }}>Interface Theme</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Toggle between dark and light modes.</p>
                    </div>
                    <button className="back-to-top-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                      Theme: {theme.toUpperCase()}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <h4 style={{ fontFamily: 'Outfit', fontSize: '1.05rem' }}>Voice Assistant Reader</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Triggers text-to-speech readouts of current local conditions.</p>
                    </div>
                    <button className="back-to-top-btn" onClick={speakWeatherReport}>
                      <i className="fas fa-volume-up"></i> Read Weather
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h4 style={{ fontFamily: 'Outfit', fontSize: '1.05rem' }}>Indian Air Standards (CPCB Conversion Scale)</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      The dashboard automatically scales WAQI data into the Central Pollution Control Board (CPCB) standards, reflecting PM2.5, PM10, SO2, NO2, and CO thresholds accurately for safety and health advices.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Bottom widgets shelf */}
          <section className="support-widgets-row" id="accessibility-section" style={{ marginTop: '32px' }}>
            <div className="widget-item-card">
              <div className="widget-icon">
                <i className="fas fa-wifi"></i>
                <span className={`status-dot ${isOnline ? '' : 'offline'}`} id="offline-status-dot"></span>
              </div>
              <h5>Offline Support</h5>
              <p>{isOnline ? "Fully functional online" : "Working offline (cached)"}</p>
            </div>
            
            <div className="widget-item-card" style={{ cursor: 'pointer' }} onClick={speakWeatherReport}>
              <div className="widget-icon">
                <i className="fas fa-microphone"></i>
              </div>
              <h5>Voice Assistant</h5>
              <p>Read weather report aloud</p>
            </div>
            
            <div className="widget-item-card" style={{ cursor: 'pointer' }} onClick={() => {
              if (weatherData) {
                alert(`AI WEATHER ADVICE:\n\n${aiInsight.text}`);
              } else {
                alert("Search a city first to load AI health insights.");
              }
            }}>
              <div className="widget-icon">
                <i className="fas fa-brain"></i>
              </div>
              <h5>AI Insights</h5>
              <p>Smart health & clothing advice</p>
            </div>
            
            <div className="widget-item-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('settings')}>
              <div className="widget-icon">
                <i className="fas fa-globe"></i>
              </div>
              <h5>Indian Standards</h5>
              <p>CPCB AQI conversion scale</p>
            </div>
          </section>

          {/* Footer Area */}
          <footer class="app-footer">
            <button onClick={scrollToTop} className="back-to-top-btn"><i class="fas fa-arrow-up"></i> Back to Top</button>
            <div class="footer-nav">
              <a href="/docs/" target="_blank">Documentation</a>
              <a href="/privacy/" target="_blank">Privacy Policy</a>
              <a href="/terms/" target="_blank">Terms of Service</a>
              <a href="/contact/" target="_blank">Contact Us</a>
            </div>
            <div class="footer-socials">
              <a href="https://github.com/NandakishorNaiR" target="_blank"><i class="fab fa-github"></i></a>
              <a href="https://x.com/Nandakishor02" target="_blank"><i class="fab fa-twitter"></i></a>
              <a href="https://instagram.com/nandakishor_nair_0109" target="_blank"><i class="fab fa-instagram"></i></a>
            </div>
            <p>KnoxyView © 2026 Knoxy Nexus Studios. All rights reserved.</p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <a className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); scrollToTop(); }}>
          <i className="fas fa-home"></i>Home
        </a>
        <a className="mobile-nav-item" onClick={focusSearchInput}>
          <i className="fas fa-search"></i>Search
        </a>
        <a className={`mobile-nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => { setActiveTab('map'); scrollToTop(); }}>
          <i className="fas fa-map"></i>Map
        </a>
        <a className="mobile-nav-item" onClick={() => navigateToSection('alerts-card-section')}>
          <i className="fas fa-bell"></i>Alerts
        </a>
        <a className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); scrollToTop(); }}>
          <i className="fas fa-cog"></i>Settings
        </a>
      </nav>

      {/* Floating PWA Install Prompt Banner */}
      {showPwaBanner && deferredPrompt && (
        <div className="pwa-prompt-banner" id="pwa-install-banner" style={{ display: 'flex' }}>
          <div className="pwa-logo-wrapper">
            <img src="/static/weather/images/logo.svg" alt="KnoxyView App Logo" style={{ width: '32px', height: '32px' }} />
          </div>
          <div className="pwa-prompt-info">
            <h4>Install KnoxyView App</h4>
            <p>Get real-time updates and offline reports on your home screen.</p>
          </div>
          <div className="pwa-prompt-actions">
            <button className="pwa-btn install" onClick={handleInstallPWA}>Install</button>
            <button className="pwa-btn dismiss" onClick={() => setShowPwaBanner(false)}>Later</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
