

# 🌤️ Weather App (Django)

A clean, beginner‑friendly Django web app that shows **current weather** and **air quality (AQI)** for a given location. It’s designed to be easy to run locally, simple to understand, and straightforward to deploy.

**Live demo:** [https://weatherapp2-0knoxyvieww-1.onrender.com](https://weatherapp2-0knoxyvieww-1.onrender.com)

---

## ✨ What this app does

* Displays current **weather information** in a simple web UI
* Shows **air quality (AQI)** alongside weather data
* Uses Django services to keep API logic clean and reusable
* Works out‑of‑the‑box with SQLite for local development
* Includes Windows‑friendly production setup using **Waitress**

---

## 🧠 How it’s structured

Here’s a high‑level overview of the repository so you can quickly find your way around:

```
knoxyview/          # Django project (settings, URLs, WSGI)
  ├─ settings.py
  ├─ wsgi.py

weather/            # Main Django app
  ├─ models.py
  ├─ views.py
  ├─ urls.py
  ├─ services/      # External API logic
  │   ├─ weather_service.py
  │   └─ aqi_service.py
  ├─ templates/
  │   └─ weather/   # HTML templates
  └─ static/        # CSS / JS assets

requirements.txt    # Python dependencies
serve_waitress.ps1  # Run with Waitress (PowerShell)
serve_waitress.bat  # Run with Waitress (CMD)
```

The **services** folder is where all external API calls live, keeping views clean and easier to maintain.

---

## 🧩 Requirements

* **Python 3.8+** (recommended: **Python 3.11**)
* All dependencies are listed in `requirements.txt`

> ⚠️ On Windows, some packages (like `pywin32`) are installed conditionally based on Python version. Stick to the recommended version for fewer surprises.

---

## 🚀 Run locally (quick start)

### 1️⃣ Create & activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2️⃣ Install dependencies

```powershell
python -m pip install -r requirements.txt
```

### 3️⃣ Run migrations and start the dev server

```powershell
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Now open 👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 🏭 Run with Waitress (production‑like, Windows‑friendly)

This project includes ready‑to‑use scripts to run the app using **Waitress**, which works well on Windows.

### PowerShell

```powershell
python -m pip install -r requirements.txt
.\serve_waitress.ps1
```

### CMD

```bat
python -m pip install -r requirements.txt
serve_waitress.bat
```

### Or run directly

```powershell
waitress-serve --host=0.0.0.0 --port=8000 knoxyview.wsgi:application
```

---

## ☁️ Deployment notes (Render.com)

This app is deployed on **Render**, and the live demo is available at the link above.

* `ALLOWED_HOSTS` is loaded from an environment variable
* By default, `.onrender.com` is allowed

Example:

```env
ALLOWED_HOSTS=weatherapp2-0knoxyvieww-1.onrender.com,localhost,127.0.0.1
```

### For a real production setup, consider:

* Setting `DEBUG = False`
* Moving `SECRET_KEY` to environment variables
* Using PostgreSQL instead of SQLite
* Serving static files via Render or an object store (S3, etc.)

---

## 🛠 Scripts & helpers

* `serve_waitress.ps1` — Run the app with Waitress (PowerShell)
* `serve_waitress.bat` — Run the app with Waitress (CMD)

---

## 🧪 Notes & troubleshooting

* **Gunicorn does not work on Windows** (depends on `fcntl`)

  * Use **Waitress** on Windows
  * Or run Gunicorn inside **WSL / Linux**

* If you see a `DisallowedHost` error:

  * Add the domain to `ALLOWED_HOSTS`
  * Or set the `ALLOWED_HOSTS` environment variable on your host

---

## 🙌 Final thoughts

This project is meant to be **simple, readable, and practical**—great for learning Django, deploying a real app, or extending with features like forecasts, maps, or user preferences.

Feel free to fork it, break it, and improve it 🚀
