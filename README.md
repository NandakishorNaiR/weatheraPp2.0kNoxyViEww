# Weather (Django)

A minimal Django-based weather application that provides current weather and air-quality information. This repository contains the Django project, a `weather` app, static assets, and helper scripts for running locally and on Windows.

**Live demo:** https://weatherapp2-0knoxyvieww-1.onrender.com

**Key features**
- Django-based web UI for weather information
- Services for fetching weather and AQI (`weather/services/*.py`)
- Simple SQLite database for local development

**Repository structure (high level)**
- `knoxyview/` — Django project settings and WSGI entry (`knoxyview/settings.py`, `knoxyview/wsgi.py`)
- `weather/` — Django app: models, views, URLs, templates, static assets
  - `weather/services/` — `weather_service.py`, `aqi_service.py` used to fetch external data
  - `weather/templates/weather/` — HTML templates (index page)
  - `weather/static/` — app static files (JS/CSS)
- `requirements.txt` — pinned Python dependencies (includes Windows/conditional entries)
- `serve_waitress.ps1`, `serve_waitress.bat` — convenience scripts to run the app with Waitress on port 8000

**Requirements**
- Python 3.8+ (recommended: 3.11; some pinned packages are version-sensitive)
- See `requirements.txt` for full dependency list. On Windows, some packages like `pywin32` are only installed for supported Python versions.

**Local development (quick start)**
1. Create and activate a virtual environment:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
2. Install dependencies:
```powershell
python -m pip install -r requirements.txt
```
3. Apply migrations and run the dev server:
```powershell
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Open http://127.0.0.1:8000 in your browser.

**Run with Waitress (production-like, Windows friendly)**
The repo includes `serve_waitress.ps1` and `serve_waitress.bat` which run the app on port 8000 using Waitress.

PowerShell:
```powershell
python -m pip install -r requirements.txt
.\serve_waitress.ps1
```

CMD:
```bat
python -m pip install -r requirements.txt
serve_waitress.bat
```

Or run directly:
```powershell
waitress-serve --host=0.0.0.0 --port=8000 knoxyview.wsgi:application
```

**Deployment notes (Render.com)**
- The project was deployed to Render at the live URL above. `knoxyview/settings.py` loads `ALLOWED_HOSTS` from the `ALLOWED_HOSTS` environment variable and defaults to allowing `.onrender.com`.
- If you deploy to another host, set the `ALLOWED_HOSTS` env var (comma-separated), e.g. `weatherapp2-0knoxyvieww-1.onrender.com,localhost,127.0.0.1`.
- For production consider:
  - Turning `DEBUG = False` and configuring `SECRET_KEY` via environment variables
  - Using a production database (Postgres) and configuring static file hosting (S3 or Render static files)

**Scripts and helpers**
- `serve_waitress.ps1` — PowerShell helper to run Waitress on port 8000
- `serve_waitress.bat` — Windows CMD helper to run Waitress on port 8000

**Notes & troubleshooting**
- `gunicorn` is Unix-only and depends on `fcntl`; it will not run on Windows. Use Waitress on Windows or run `gunicorn` inside WSL/Linux.
- If you see `DisallowedHost` errors on deployment, add the host to `ALLOWED_HOSTS` or set the `ALLOWED_HOSTS` env var on your hosting provider.

If you'd like, I can expand any section (detailed API, screenshots, or CI/deploy steps) or add a small `CONTRIBUTING.md` or `NOTES.md` file.
