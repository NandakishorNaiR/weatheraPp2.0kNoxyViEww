from django.urls import path
from .views import HomeView, FetchWeatherView, FetchWeatherAPIView, documentation_view, privacy_view, terms_view, contact_view, service_worker, web_manifest

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('weather/', FetchWeatherView.as_view(), name='fetch_weather'),
    path('api/weather/', FetchWeatherAPIView.as_view(), name='fetch_weather_api'),
    path('docs/', documentation_view, name='documentation'),
    path('privacy/', privacy_view, name='privacy'),
    path('terms/', terms_view, name='terms'),
    path('contact/', contact_view, name='contact'),
    path('sw.js', service_worker, name='service_worker'),
    path('manifest.json', web_manifest, name='web_manifest'),
]
