from django.urls import path
from .views import HomeView, FetchWeatherView, documentation_view, privacy_view, terms_view, contact_view

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('weather/', FetchWeatherView.as_view(), name='fetch_weather'),
    path('docs/', documentation_view, name='documentation'),
    path('privacy/', privacy_view, name='privacy'),
    path('terms/', terms_view, name='terms'),
    path('contact/', contact_view, name='contact'),
]
