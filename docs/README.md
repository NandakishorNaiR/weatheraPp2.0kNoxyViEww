# KnoxyView Weather — Documentation

## Overview
KnoxyView is a Django-based weather dashboard that shows current weather, 5-day forecast, UV index, and air quality (WAQI). This document describes setup, running, testing (including latency checks), and key UI behaviors.

## Prerequisites
- Python 3.10+
- Git (optional)
- A virtual environment (recommended)

## Setup (Windows)
1. Create and activate a virtual environment (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Copy environment sample and add API keys:

```powershell
copy .env.example .env
# Edit .env to set OPENWEATHER_API_KEY and WAQI_API_KEY
```

4. Run migrations (if needed):

```powershell
python manage.py migrate
```

## Run the development server

```powershell
python manage.py runserver
```

Open http://127.0.0.1:8000/ in your browser.

## Key UI Behaviors
- Theme toggle: Click the "Light Mode" button in Accessibility Controls to switch between dark and light themes. The choice persists in `localStorage`.
- AQI source: WAQI is the primary AQI provider. The app uses provider `aqi` as a fallback when detailed pollutant data is missing.
- Weather badges: Day/night/haze/cloudy mapping is rendered server-side and shown under the temperature.
- Wind gust: Shown when OpenWeather provides `wind.gust`.

## Latency Testing (Local)
To measure latency against your running local dev server (once `runserver` is active):

Using `curl` in PowerShell (5 requests):

```powershell
for ($i=0; $i -lt 5; $i++) { curl -s -w "\nTime_total: %{time_total}\n" http://127.0.0.1:8000/ -o $null }
```

Using Python (requests) to measure average response time:

```python
import time, requests
url = 'http://127.0.0.1:8000/'
trials = 5
times = []
for _ in range(trials):
    t0 = time.time()
    r = requests.get(url)
    times.append(time.time() - t0)
print('times:', times)
print('avg:', sum(times)/len(times))
```

Note: For realistic production latency measurement, run the app under a production server (e.g., gunicorn/uvicorn behind nginx) and test network conditions.

## Troubleshooting
- "ModuleNotFoundError: No module named 'django'": ensure you've activated the virtual environment and installed `requirements.txt`.
- If API keys are invalid, WAQI/OpenWeather requests will fail; check `.env` values.
- If pages render with missing data, check logs (runserver console) for exceptions and network reachability.

## Files of interest
- `weather/views.py` — data fetching, AQI handling, badge mapping
- `weather/templates/weather/index.html` — main UI and theme toggle
- `weather/services/` — API helper modules

## Next steps / Ideas
- Add system-prefers detection (`prefers-color-scheme`) to follow OS theme.
- Add optional 24-hour averaged AQI mode (requires historical data retention or API support).
- Add automated latency test script under `tools/`.

---

If you want a shorter README in the repo root or an expanded developer guide, tell me what to include and I will add it.
