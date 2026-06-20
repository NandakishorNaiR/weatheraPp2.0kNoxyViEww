import logging
import requests
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from django.core.cache import cache

from weather.utils import map_weather_to_badge, get_wind_direction, get_local_time, is_daytime
from weather.services.aqi_service import get_final_aqi, get_aqi_category

logger = logging.getLogger(__name__)

CACHE_TIMEOUT = 900 # 15 minutes


class WeatherServiceError(Exception):
    """Custom exception raised for errors in the WeatherService."""
    pass


def get_coordinates(city: str, api_key: str) -> Tuple[Optional[float], Optional[float]]:
    """Convert city name to lat/lon coordinates."""
    url = "http://api.openweathermap.org/geo/1.0/direct"
    params = {"q": city, "limit": 1, "appid": api_key}
    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.error(f"Geocoding error for city '{city}': {e}")
    return None, None


def reverse_geocode(lat: float, lon: float, api_key: str) -> str:
    """Convert lat/lon coordinates to city name."""
    url = "http://api.openweathermap.org/geo/1.0/reverse"
    params = {"lat": lat, "lon": lon, "limit": 1, "appid": api_key}
    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        if data:
            return str(data[0]["name"])
    except Exception as e:
        logger.error(f"Reverse geocoding error for ({lat}, {lon}): {e}")
    return "Unknown"


def fetch_weather_data(lat: float, lon: float, api_key: str) -> Dict[str, Any]:
    """Fetch current weather conditions from OpenWeather API."""
    url = "http://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
    }
    res = requests.get(url, params=params, timeout=10)
    res.raise_for_status()
    data = res.json()

    wind = data.get("wind", {})
    visibility_m = data.get("visibility", 0)
    timezone_offset = data.get("timezone", 0)
    weather_main = data["weather"][0]["main"]
    weather_desc = data["weather"][0]["description"]
    daytime = is_daytime(timezone_offset)

    return {
        "temperature": round(data["main"]["temp"]),
        "real_feel": round(data["main"]["feels_like"]),
        "description": weather_desc.title(),
        "weather_main": weather_main,
        "icon": data["weather"][0]["icon"],
        "humidity": data["main"]["humidity"],
        "pressure": data["main"]["pressure"],
        "wind_speed": round(wind.get("speed", 0), 1),
        "wind_gust": (round(wind.get("gust"), 1) if wind.get("gust") is not None else None),
        "wind_direction": get_wind_direction(wind.get("deg")),
        "visibility": round(visibility_m / 1000, 1),
        "clouds": data.get("clouds", {}).get("all", 0),
        "sunrise": get_local_time(data["sys"]["sunrise"], timezone_offset),
        "sunset": get_local_time(data["sys"]["sunset"], timezone_offset),
        "is_daytime": daytime,
        "country": data["sys"].get("country", ""),
        "badge": map_weather_to_badge(weather_main, weather_desc, daytime),
    }


def fetch_uv_index(lat: float, lon: float, api_key: str) -> Optional[Dict[str, Any]]:
    """Fetch UV Index conditions from OpenWeather One Call API."""
    try:
        url = "https://api.openweathermap.org/data/2.5/onecall"
        params = {
            "lat": lat,
            "lon": lon,
            "exclude": "minutely,hourly,daily,alerts",
            "appid": api_key,
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()

        uvi = data.get("current", {}).get("uvi")
        if uvi is None:
            return None

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

        return {
            "value": round(uvi, 1),
            "risk_level": risk[0],
            "risk_color": risk[1],
        }
    except Exception as e:
        logger.debug(f"UV index fetch failed: {e}")
    return None


def fetch_forecast_data(lat: float, lon: float, api_key: str) -> List[Dict[str, Any]]:
    """Fetch 5-day weather forecast from OpenWeather API."""
    url = "http://api.openweathermap.org/data/2.5/forecast"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
    }
    res = requests.get(url, params=params, timeout=10)
    res.raise_for_status()
    data = res.json()

    forecast_list: List[Dict[str, Any]] = []
    for item in data.get("list", []):
        dt_txt = item["dt_txt"]
        parsed_dt = datetime.strptime(dt_txt, "%Y-%m-%d %H:%M:%S")
        
        forecast_list.append({
            "date": parsed_dt.strftime("%A, %b %d"),
            "time": parsed_dt.strftime("%I:%M %p"),
            "temp": round(item["main"]["temp"]),
            "description": item["weather"][0]["description"].title(),
            "icon": item["weather"][0]["icon"],
            "humidity": item["main"]["humidity"],
            "pressure": item["main"]["pressure"],
            "wind_speed": round(item.get("wind", {}).get("speed", 0), 1),
            "wind_direction": get_wind_direction(item.get("wind", {}).get("deg")),
            "clouds": item.get("clouds", {}).get("all", 0),
            "rain_chance": round(item.get("pop", 0) * 100),
        })
    return forecast_list


def fetch_air_quality_data(lat: float, lon: float, api_key: str) -> Optional[Dict[str, Any]]:
    """Fetch air quality metrics and map to CPCB Indian scale."""
    try:
        url = f"https://api.waqi.info/feed/geo:{lat};{lon}/"
        res = requests.get(url, params={"token": api_key}, timeout=10)
        res.raise_for_status()
        data = res.json()

        if data.get("status") == "ok":
            iaqi = data["data"].get("iaqi", {})

            def extract_pollutant(d: Dict[str, Any], keys: List[str]) -> Optional[float]:
                for k in keys:
                    if k in d:
                        try:
                            return float(d[k].get("v"))
                        except Exception:
                            return None
                return None

            pm25 = extract_pollutant(iaqi, ["pm25", "pm2_5", "pm2.5"])
            pm10 = extract_pollutant(iaqi, ["pm10"])
            no2 = extract_pollutant(iaqi, ["no2"])
            so2 = extract_pollutant(iaqi, ["so2"])
            co = extract_pollutant(iaqi, ["co"])
            o3 = extract_pollutant(iaqi, ["o3"])
            nh3 = extract_pollutant(iaqi, ["nh3"])

            final_aqi = get_final_aqi(pm25=pm25, pm10=pm10, no2=no2, so2=so2, co=co, o3=o3, nh3=nh3)
            provider_aqi = data["data"].get("aqi")

            try:
                if provider_aqi is not None and int(provider_aqi) == 999:
                    provider_aqi = None
            except Exception:
                pass

            if final_aqi is None and provider_aqi is not None:
                final_aqi = int(provider_aqi)

            category, message = get_aqi_category(final_aqi)
            note = "Pollutant concentration data missing; AQI unavailable" if final_aqi is None else None

            pollutants_clean: Dict[str, float] = {}
            for k, v in iaqi.items():
                if v and v.get("v") is not None:
                    pollutants_clean[k] = float(v["v"])

            return {
                "aqi": final_aqi,
                "category": category,
                "message": message,
                "note": note,
                "pollutants": pollutants_clean,
            }
    except Exception as e:
        logger.error(f"Air quality fetch error: {e}")
    return None


def get_weather_dashboard_data(
    city: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
    weather_api_key: str,
    aqi_api_key: str,
) -> Dict[str, Any]:
    """
    Consolidated fetch with 15-minute response caching using Django's LocMemCache.
    Raises WeatherServiceError if critical parameters are missing or geocoding fails.
    """
    if not weather_api_key or not aqi_api_key:
        raise WeatherServiceError("API configurations are missing on the server.")

    # 1. Resolve coordinates if GPS coordinates aren't supplied directly
    if (lat is None or lon is None) and city:
        lat, lon = get_coordinates(city, weather_api_key)
        if lat is None or lon is None:
            raise WeatherServiceError(f"Coordinates could not be found for city: '{city}'")
    elif (lat is None or lon is None) and not city:
        raise WeatherServiceError("Coordinates or city name must be provided to fetch weather details.")

    # coordinates are fully resolved here
    resolved_lat: float = float(lat)
    resolved_lon: float = float(lon)

    # 2. Try loading consolidated dashboard data from cache
    cache_key = f"weather_dashboard_data_{resolved_lat:.4f}_{resolved_lon:.4f}"
    cached_data = cache.get(cache_key)
    if cached_data:
        logger.info(f"Serving cached dashboard weather report for coordinates ({resolved_lat}, {resolved_lon})")
        return cached_data

    # 3. Cache miss: fetch all API data
    try:
        # Geocode reverse location name if searching via coordinates directly
        resolved_city = city if city else reverse_geocode(resolved_lat, resolved_lon, weather_api_key)
        
        current_weather = fetch_weather_data(resolved_lat, resolved_lon, weather_api_key)
        uv_index = fetch_uv_index(resolved_lat, resolved_lon, weather_api_key)
        forecast = fetch_forecast_data(resolved_lat, resolved_lon, weather_api_key)
        air_quality = fetch_air_quality_data(resolved_lat, resolved_lon, aqi_api_key)

        now = datetime.now()
        dashboard_data = {
            "city": resolved_city,
            "lat": resolved_lat,
            "lon": resolved_lon,
            "current_weather": current_weather,
            "forecast": forecast,
            "air_quality": air_quality,
            "uv_index": uv_index,
            "date": now.strftime("%B %d, %Y"),
            "day": now.strftime("%A"),
            "weather_maps": {
                "lat": resolved_lat,
                "lon": resolved_lon,
                "api_key": weather_api_key,
            },
        }

        # Cache the dashboard data
        cache.set(cache_key, dashboard_data, CACHE_TIMEOUT)
        return dashboard_data

    except Exception as e:
        logger.error(f"API fetch exception in WeatherService: {e}")
        raise WeatherServiceError(f"External API failed to retrieve weather details: {e}")
