from django.apps import AppConfig
import os
import logging
import sys

logger = logging.getLogger(__name__)


class WeatherConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'weather'
    verbose_name = 'Weather'

    def ready(self) -> None:
        # Check API keys if we are starting a server
        if any(cmd in sys.argv for cmd in ['runserver', 'gunicorn', 'waitress']):
            openweather_key = os.environ.get("OPENWEATHER_API_KEY")
            waqi_key = os.environ.get("WAQI_API_KEY")
            
            if not openweather_key:
                logger.error("CRITICAL CONFIGURATION ERROR: 'OPENWEATHER_API_KEY' is missing in environment variables.")
            if not waqi_key:
                logger.error("CRITICAL CONFIGURATION ERROR: 'WAQI_API_KEY' is missing in environment variables.")
