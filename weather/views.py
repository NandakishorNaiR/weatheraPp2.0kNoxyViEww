import logging
import os
from django.shortcuts import render, redirect
from django.views import View
from django.conf import settings
from django.http import HttpResponse, HttpRequest, JsonResponse
from typing import Union, Any, Dict

from .models import Weather
from weather.services.weather_service import get_weather_dashboard_data, WeatherServiceError

logger = logging.getLogger(__name__)


class HomeView(View):
    """Displays the home page landing state."""
    def get(self, request: HttpRequest) -> HttpResponse:
        city = request.GET.get("city")
        if city:
            react_index = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'index.html')
            if os.path.exists(react_index):
                return redirect(f"/?city={city}")
            return redirect(f"/weather/?city={city}")
            
        react_index = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'index.html')
        if os.path.exists(react_index):
            return render(request, 'index.html')
        return render(request, "weather/index.html")


class FetchWeatherAPIView(View):
    """API endpoint returning consolidated weather and CPCB AQI data."""

    def get(self, request: HttpRequest) -> JsonResponse:
        city = request.GET.get("city")
        lat = request.GET.get("lat")
        lon = request.GET.get("lon")

        weather_api_key = os.getenv("OPENWEATHER_API_KEY", "")
        aqi_api_key = os.getenv("WAQI_API_KEY", "")

        float_lat = None
        float_lon = None
        if lat and lon:
            try:
                float_lat = float(lat)
                float_lon = float(lon)
            except ValueError:
                response = JsonResponse({"error": "Invalid lat/lon coordinate parameters."}, status=400)
                response["Access-Control-Allow-Origin"] = "*"
                return response

        try:
            dashboard_data = get_weather_dashboard_data(
                city=city,
                lat=float_lat,
                lon=float_lon,
                weather_api_key=weather_api_key,
                aqi_api_key=aqi_api_key
            )
            if dashboard_data.get("current_weather") and dashboard_data.get("city"):
                FetchWeatherView.store_weather_data(dashboard_data["city"], dashboard_data["current_weather"])
            
            response = JsonResponse(dashboard_data)
        except WeatherServiceError as e:
            response = JsonResponse({"error": str(e)}, status=400)
        except Exception as e:
            logger.error(f"Unexpected API exception: {e}")
            response = JsonResponse({"error": "An unexpected error occurred while loading weather data."}, status=500)
        
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Headers"] = "*"
        return response


class FetchWeatherView(View):
    """
    Fetches consolidated weather and CPCB air quality details using coordinates or city name.
    Utilizes 15-minute LocMem caching in weather_service.
    """

    def get(self, request: HttpRequest) -> HttpResponse:
        city = request.GET.get("city")
        lat = request.GET.get("lat")
        lon = request.GET.get("lon")

        react_index = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'index.html')
        if os.path.exists(react_index):
            params = []
            if city:
                params.append(f"city={city}")
            if lat and lon:
                params.append(f"lat={lat}&lon={lon}")
            query_str = "?" + "&".join(params) if params else ""
            return redirect(f"/{query_str}")

        weather_api_key = os.getenv("OPENWEATHER_API_KEY", "")
        aqi_api_key = os.getenv("WAQI_API_KEY", "")

        # 1. Initialize view context
        context: Dict[str, Any] = {
            "city": city,
            "current_weather": None,
            "forecast": [],
            "air_quality": None,
            "error": None,
        }

        # 2. Convert string coordinates if present
        float_lat = None
        float_lon = None
        if lat and lon:
            try:
                float_lat = float(lat)
                float_lon = float(lon)
            except ValueError:
                context["error"] = "Invalid lat/lon coordinate parameters."
                return render(request, "weather/index.html", context)

        # 3. Call weather service to fetch cached/fresh report
        try:
            dashboard_data = get_weather_dashboard_data(
                city=city,
                lat=float_lat,
                lon=float_lon,
                weather_api_key=weather_api_key,
                aqi_api_key=aqi_api_key
            )
            
            # Map dashboard data to template context
            context.update(dashboard_data)

            # Store search query persistently in local DB for statistics
            if context.get("current_weather") and context.get("city"):
                self.store_weather_data(context["city"], context["current_weather"])

        except WeatherServiceError as e:
            logger.error(f"WeatherService error: {e}")
            context["error"] = str(e)
        except Exception as e:
            logger.error(f"Unexpected view controller exception: {e}")
            context["error"] = "An unexpected error occurred while loading weather data."

        return render(request, "weather/index.html", context)

    @staticmethod
    def store_weather_data(city: str, weather_data: Dict[str, Any]) -> None:
        """Stores search weather record persistently in local DB."""
        try:
            Weather.objects.create(
                city=city,
                temperature=weather_data["temperature"],
                description=weather_data["description"],
                humidity=weather_data.get("humidity"),
                pressure=weather_data.get("pressure"),
                real_feel=weather_data.get("real_feel"),
                wind_direction=weather_data.get("wind_direction"),
                sunrise=weather_data.get("sunrise"),
                is_daytime=weather_data.get("is_daytime", True),
            )
        except Exception as e:
            logger.error(f"Failed to persist weather search into DB: {e}")


def service_worker(request: HttpRequest) -> HttpResponse:
    """Serves the PWA Service Worker script from the root scope."""
    try:
        sw_path = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'sw.js')
        if not os.path.exists(sw_path):
            sw_path = os.path.join(settings.BASE_DIR, 'weather', 'static', 'weather', 'js', 'sw.js')
        with open(sw_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='application/javascript')
    except Exception as e:
        logger.error(f"Failed to load sw.js: {e}")
        return HttpResponse("// sw.js load error", content_type='application/javascript', status=404)


def web_manifest(request: HttpRequest) -> HttpResponse:
    """Serves the PWA Web Manifest details from the root scope."""
    try:
        manifest_path = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'manifest.json')
        if not os.path.exists(manifest_path):
            manifest_path = os.path.join(settings.BASE_DIR, 'weather', 'static', 'weather', 'manifest.json')
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='application/json')
    except Exception as e:
        logger.error(f"Failed to load manifest.json: {e}")
        return HttpResponse("{}", content_type='application/json', status=404)


def documentation_view(request: HttpRequest) -> HttpResponse:
    """Render the project documentation HTML page."""
    return render(request, "docs/documentation.html")


def privacy_view(request: HttpRequest) -> HttpResponse:
    """Render the privacy policy HTML page."""
    return render(request, "docs/privacy.html")


def terms_view(request: HttpRequest) -> HttpResponse:
    """Render the Terms of Service HTML page."""
    return render(request, "docs/terms.html")


def contact_view(request: HttpRequest) -> HttpResponse:
    """Render a simple Contact Us page."""
    return render(request, "docs/contact.html")
