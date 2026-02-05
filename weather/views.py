import logging
import requests
import os
from datetime import datetime, timedelta


from django.shortcuts import render, redirect
from django.views import View
from django.conf import settings

from .models import Weather

logger = logging.getLogger(__name__)


# ------------------ AQI (US EPA) Utilities ------------------
PM25_BREAKPOINTS = [
    (0.0, 12.0, 0, 50),
    (12.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 150.4, 151, 200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500),
]

PM10_BREAKPOINTS = [
    (0, 54, 0, 50),
    (55, 154, 51, 100),
    (155, 254, 101, 150),
    (255, 354, 151, 200),
    (355, 424, 201, 300),
    (425, 504, 301, 400),
    (505, 604, 401, 500),
]


def calculate_aqi(concentration, breakpoints):
    try:
        concentration = float(concentration)
    except Exception:
        return None

    for bp_low, bp_high, aqi_low, aqi_high in breakpoints:
        if bp_low <= concentration <= bp_high:
            return round(((aqi_high - aqi_low) / (bp_high - bp_low)) * (concentration - bp_low) + aqi_low)
    return None


def pm25_to_aqi(pm25):
    return calculate_aqi(pm25, PM25_BREAKPOINTS)


def pm10_to_aqi(pm10):
    return calculate_aqi(pm10, PM10_BREAKPOINTS)


def get_final_aqi(pm25=None, pm10=None):
    aqi_values = []
    if pm25 is not None:
        a = pm25_to_aqi(pm25)
        if a is not None:
            aqi_values.append(a)
    if pm10 is not None:
        a = pm10_to_aqi(pm10)
        if a is not None:
            aqi_values.append(a)
    if not aqi_values:
        return None
    return min(max(aqi_values), 500)


def get_aqi_category(aqi):
    if aqi is None:
        return ("Unknown", "AQI unavailable")
    try:
        aqi = float(aqi)
    except Exception:
        return ("Unknown", "AQI unavailable")

    if aqi <= 50:
        return ("Good", "Air quality is satisfactory.")
    elif aqi <= 100:
        return ("Moderate", "Air quality is acceptable.")
    elif aqi <= 150:
        return ("Unhealthy for Sensitive Groups", "Sensitive groups should limit outdoor activity.")
    elif aqi <= 200:
        return ("Unhealthy", "Everyone may experience health effects.")
    elif aqi <= 300:
        return ("Very Unhealthy", "Health alert: everyone may experience serious effects.")
    else:
        return ("Hazardous", "Emergency conditions. Avoid outdoor activity.")






class HomeView(View):
    """
    Displays the home page.
    """
    def get(self, request):
        city = request.GET.get("city")
        if city:
            return redirect(f"/weather/?city={city}")
        return render(request, "weather/index.html")


class FetchWeatherView(View):
    """
    Fetches weather data using GPS (lat/lon) or city name.
    GPS is ALWAYS preferred to avoid server-location issues.
    """

    def get(self, request):
        city = request.GET.get("city")
        lat = request.GET.get("lat")
        lon = request.GET.get("lon")

        weather_api_key = os.getenv("OPENWEATHER_API_KEY")
        aqi_api_key = os.getenv("WAQI_API_KEY")

        if not weather_api_key or not aqi_api_key:
            logger.error("API keys missing")
            return render(request, "weather/index.html", {"error": "Server configuration error"})

        context = self.initialize_context(city)

        # 🔥 GPS FIRST (CRITICAL FIX)
        if lat and lon:
            city = self.reverse_geocode(lat, lon, weather_api_key)
            context["city"] = city

        # Fallback: city → lat/lon
        elif city:
            lat, lon = self.get_coordinates(city, weather_api_key, context)

        else:
            context["error"] = "Location not provided"
            return render(request, "weather/index.html", context)

        if lat and lon:
            self.fetch_weather_data(lat, lon, weather_api_key, context)
            # UV index (best-effort)
            try:
                self.fetch_uv_index(lat, lon, weather_api_key, context)
            except Exception:
                pass
            self.fetch_forecast_data(lat, lon, weather_api_key, context)

            # Fetch air quality from WAQI (primary source)
            self.fetch_air_quality_data(lat, lon, aqi_api_key, context)

            context["weather_maps"] = {
                "lat": lat,
                "lon": lon,
                "api_key": weather_api_key,
            }

            if context.get("current_weather") and city:
                self.store_weather_data(city, context["current_weather"])

        return render(request, "weather/index.html", context)

    # ------------------ Helpers ------------------

    @staticmethod
    def initialize_context(city):
        now = datetime.now()
        return {
            "city": city,
            "current_weather": None,
            "forecast": [],
            "air_quality": None,
            "error": None,
            "date": now.strftime("%B %d, %Y"),
            "day": now.strftime("%A"),
        }

    def get_coordinates(self, city, api_key, context):
        url = "http://api.openweathermap.org/geo/1.0/direct"
        params = {"q": city, "limit": 1, "appid": api_key}
        try:
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()
            if data:
                return data[0]["lat"], data[0]["lon"]
            context["error"] = "City not found"
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
            context["error"] = "Failed to fetch coordinates"
        return None, None

    def reverse_geocode(self, lat, lon, api_key):
        url = "http://api.openweathermap.org/geo/1.0/reverse"
        params = {"lat": lat, "lon": lon, "limit": 1, "appid": api_key}
        try:
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()
            return data[0]["name"] if data else "Unknown"
        except Exception as e:
            logger.error(f"Reverse geocode error: {e}")
            return "Unknown"

    def fetch_weather_data(self, lat, lon, api_key, context):
        try:
            url = "http://api.openweathermap.org/data/2.5/weather"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": api_key,
                "units": "metric",
            }
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()

            wind = data.get("wind", {})
            visibility_m = data.get("visibility", 0)

            context["current_weather"] = {
                "temperature": round(data["main"]["temp"]),
                "real_feel": round(data["main"]["feels_like"]),
                "description": data["weather"][0]["description"].title(),
                "weather_main": data["weather"][0]["main"],
                "icon": data["weather"][0]["icon"],
                "humidity": data["main"]["humidity"],
                "pressure": data["main"]["pressure"],
                "wind_speed": round(wind.get("speed", 0), 1),
                "wind_gust": (round(wind.get("gust"), 1) if wind.get("gust") is not None else None),
                "wind_direction": self.get_wind_direction(wind.get("deg")),
                "visibility": round(visibility_m / 1000, 1),
                "clouds": data.get("clouds", {}).get("all", 0),
                "sunrise": self.get_local_time(data["sys"]["sunrise"], data["timezone"]),
                "sunset": self.get_local_time(data["sys"]["sunset"], data["timezone"]),
                "is_daytime": self.is_daytime(data["timezone"]),
                "country": data["sys"].get("country", ""),
                "badge": self.map_weather_to_badge(
                    data["weather"][0]["main"],
                    data["weather"][0]["description"],
                    self.is_daytime(data["timezone"]),
                ),
            }
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            context["error"] = "Failed to fetch weather data"

    def fetch_uv_index(self, lat, lon, api_key, context):
        """Fetch UV index using OpenWeather One Call API and map to risk levels."""
        try:
            url = "https://api.openweathermap.org/data/2.5/onecall"
            params = {
                "lat": lat,
                "lon": lon,
                "exclude": "minutely,hourly,daily,alerts",
                "appid": api_key,
            }
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()

            uvi = data.get("current", {}).get("uvi")
            if uvi is None:
                return

            # classify risk
            if uvi <= 2:
                risk = ("Low", "green")
            elif uvi <= 5:
                risk = ("Moderate", "yellow")
            elif uvi <= 7:
                risk = ("High", "orange")
            elif uvi <= 10:
                risk = ("Very High", "red")
            else:
                risk = ("Extreme", "purple")

            context["uv_index"] = {
                "value": round(uvi, 1),
                "risk_level": risk[0],
                "risk_color": risk[1],
            }
        except Exception as e:
            logger.debug(f"UV fetch error: {e}")

    def fetch_forecast_data(self, lat, lon, api_key, context):
        try:
            url = "http://api.openweathermap.org/data/2.5/forecast"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": api_key,
                "units": "metric",
            }
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()

            context["forecast"] = [
                {
                    "date": datetime.strptime(item["dt_txt"], "%Y-%m-%d %H:%M:%S")
                    .strftime("%A, %b %d"),
                    "time": datetime.strptime(item["dt_txt"], "%Y-%m-%d %H:%M:%S")
                    .strftime("%I:%M %p"),
                    "temp": round(item["main"]["temp"]),
                    "description": item["weather"][0]["description"].title(),
                    "icon": item["weather"][0]["icon"],
                    "humidity": item["main"]["humidity"],
                    "pressure": item["main"]["pressure"],
                    "wind_speed": round(item.get("wind", {}).get("speed", 0), 1),
                    "wind_direction": self.get_wind_direction(
                        item.get("wind", {}).get("deg")
                    ),
                    "clouds": item.get("clouds", {}).get("all", 0),
                    "rain_chance": round(item.get("pop", 0) * 100),
                }
                for item in data.get("list", [])
            ]
        except Exception as e:
            logger.error(f"Forecast error: {e}")
            context["error"] = "Failed to fetch forecast"

    def fetch_air_quality_data(self, lat, lon, api_key, context):
        try:
            url = f"https://api.waqi.info/feed/geo:{lat};{lon}/"
            res = requests.get(url, params={"token": api_key})
            res.raise_for_status()
            data = res.json()
            # WAQI response processing
            if data.get("status") == "ok":
                iaqi = data["data"].get("iaqi", {})

                # Helper: robust pollutant extraction (handles common key variants)
                def extract_pollutant(d, keys):
                    for k in keys:
                        if k in d:
                            try:
                                return float(d[k].get("v"))
                            except Exception:
                                return None
                    return None

                pm25 = extract_pollutant(iaqi, ["pm25", "pm2_5", "pm2.5"])
                pm10 = extract_pollutant(iaqi, ["pm10"])

                # Compute AQI using EPA conversion if possible
                final_aqi = get_final_aqi(pm25=pm25, pm10=pm10)

                # Debug/logging: capture provider AQI and iaqi keys when conversion fails
                provider_aqi = data["data"].get("aqi")
                logger.debug(f"WAQI provider_aqi={provider_aqi} iaqi_keys={list(iaqi.keys())} pm25={pm25} pm10={pm10} computed_aqi={final_aqi}")

                # WAQI uses 999 as a placeholder for unavailable — treat as missing
                try:
                    if provider_aqi is not None and int(provider_aqi) == 999:
                        provider_aqi = None
                except Exception:
                    pass

                if final_aqi is None:
                    final_aqi = provider_aqi

                category, message = get_aqi_category(final_aqi)

                # Add an explanatory note when AQI couldn't be computed
                note = None
                if final_aqi is None:
                    note = "Pollutant concentration data missing; AQI unavailable"

                context["air_quality"] = {
                    "aqi": final_aqi,
                    "category": category,
                    "message": message,
                    "note": note,
                    "pollutants": {k: v["v"] for k, v in iaqi.items()},
                }
            else:
                context["error"] = "AQI data unavailable"
            
        except Exception as e:
            logger.error(f"AQI error: {e}")
            context["error"] = "Failed to fetch air quality"

    def store_weather_data(self, city, weather_data):
        try:
            Weather.objects.create(
                city=city,
                temperature=weather_data["temperature"],
                description=weather_data["description"],
                humidity=weather_data["humidity"],
                pressure=weather_data["pressure"],
                real_feel=weather_data["real_feel"],
                wind_direction=weather_data["wind_direction"],
                sunrise=weather_data["sunrise"],
                is_daytime=weather_data["is_daytime"],
            )
        except Exception as e:
            logger.error(f"DB save error: {e}")

    

    # ------------------ Utilities ------------------

    @staticmethod
    def map_weather_to_badge(weather_main, description, is_daytime):
        """Return a simple badge dict with icon, label and color for UI display.

        Uses FontAwesome icon names (prefixed with 'fa-') which the template
        already loads. Colors are simple hex values used inline for now.
        """
        desc = (description or "").lower()
        main = (weather_main or "").lower()

        # Default
        icon = "fa-sun"
        label = description or (weather_main or "Unknown")
        color = "#f59e0b" if is_daytime else "#94a3b8"
        btype = "default"

        if "clear" in main:
            icon = "fa-sun" if is_daytime else "fa-moon"
            label = "Clear"
            color = "#ffd166" if is_daytime else "#93c5fd"
            btype = "clear"
        elif "cloud" in main:
            icon = "fa-cloud-sun" if is_daytime else "fa-cloud-moon"
            label = "Cloudy"
            color = "#cbd5e1"
            btype = "cloudy"
        elif "rain" in desc or "drizzle" in desc:
            icon = "fa-cloud-showers-heavy"
            label = "Rain"
            color = "#3b82f6"
            btype = "rain"
        elif "snow" in desc:
            icon = "fa-snowflake"
            label = "Snow"
            color = "#7dd3fc"
            btype = "snow"
        elif "thunder" in desc or "storm" in desc:
            icon = "fa-bolt"
            label = "Thunderstorm"
            color = "#f97316"
            btype = "thunder"
        elif "haze" in desc or "smoke" in desc or "fog" in desc or "mist" in desc:
            icon = "fa-smog"
            label = "Hazy"
            color = "#94a3b8"
            btype = "hazy"
        elif "wind" in main or "breeze" in desc:
            icon = "fa-wind"
            label = "Windy"
            color = "#60a5fa"
            btype = "windy"

        return {"icon": icon, "label": label, "color": color, "type": btype}

    @staticmethod
    def get_wind_direction(degree):
        if degree is None:
            return "N/A"
        directions = [
            "North", "NorthEast", "East", "SouthEast",
            "South", "SouthWest", "West", "NorthWest"
        ]
        return directions[int((degree / 45) + 0.5) % 8]

    @staticmethod
    def get_local_time(timestamp, offset):
        return (datetime.utcfromtimestamp(timestamp + offset)).strftime("%I:%M %p")

    @staticmethod
    def is_daytime(offset):
        local_hour = (datetime.utcnow() + timedelta(seconds=offset)).hour
        return 6 <= local_hour < 18


def documentation_view(request):
    """Render the project documentation HTML page."""
    return render(request, "docs/documentation.html")


def privacy_view(request):
    """Render the privacy policy HTML page."""
    return render(request, "docs/privacy.html")


def terms_view(request):
    """Render the Terms of Service HTML page."""
    return render(request, "docs/terms.html")


def contact_view(request):
    """Render a simple Contact Us page."""
    return render(request, "docs/contact.html")
