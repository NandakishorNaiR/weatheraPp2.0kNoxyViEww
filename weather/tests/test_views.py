import pytest
import os
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.test import Client

# Bypass Python 3.14 context copy bug in Django client test template logger
import django.test.client
django.test.client.store_rendered_templates = lambda *args, **kwargs: None

@pytest.mark.django_db
@patch('os.path.exists')
def test_home_view_without_react(mock_exists) -> None:
    mock_exists.return_value = False
    client = Client()
    response = client.get(reverse('home'))
    assert response.status_code == 200
    assert b"Welcome to KnoxyView" in response.content


@pytest.mark.django_db
@patch('os.path.exists')
def test_home_view_with_react(mock_exists) -> None:
    mock_exists.return_value = True
    client = Client()
    response = client.get(reverse('home'))
    assert response.status_code == 200
    assert b"<!DOCTYPE html>" in response.content
    assert b"root" in response.content


@pytest.mark.django_db
def test_pwa_service_worker_scope() -> None:
    client = Client()
    response = client.get('/sw.js')
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/javascript'


@pytest.mark.django_db
def test_pwa_web_manifest_scope() -> None:
    client = Client()
    response = client.get('/manifest.json')
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/json'


@pytest.mark.django_db
@patch('weather.views.get_weather_dashboard_data')
@patch('os.path.exists')
def test_fetch_weather_view_success_without_react(mock_exists, mock_get_data) -> None:
    mock_exists.return_value = False
    mock_get_data.return_value = {
        "city": "Mumbai",
        "current_weather": {
            "temperature": 27,
            "real_feel": 30,
            "description": "Clear Sky",
            "icon": "01d",
            "humidity": 68,
            "pressure": 1013,
            "wind_speed": 4.2,
            "wind_direction": "SouthEast",
            "sunrise": "06:08 AM",
            "sunset": "07:15 PM",
            "is_daytime": True,
            "badge": {
                "icon": "fa-sun",
                "label": "Clear",
                "color": "#ffd166",
                "type": "clear"
            }
        },
        "forecast": [],
        "air_quality": {
            "aqi": 75,
            "category": "Satisfactory",
            "message": "May cause minor breathing discomfort to sensitive people.",
            "note": None,
            "pollutants": {"pm25": 15, "pm10": 75}
        },
        "date": "June 20, 2026",
        "day": "Saturday",
        "weather_maps": {"lat": 19.076, "lon": 72.877, "api_key": "dummy"}
    }

    client = Client()
    response = client.get(reverse('fetch_weather'), {'city': 'Mumbai'})
    
    assert response.status_code == 200
    assert b"Mumbai" in response.content
    assert b"Clear Sky" in response.content
    assert b"Satisfactory" in response.content


@pytest.mark.django_db
@patch('weather.views.get_weather_dashboard_data')
@patch('os.path.exists')
def test_fetch_weather_view_success_with_react(mock_exists, mock_get_data) -> None:
    mock_exists.return_value = True
    client = Client()
    response = client.get(reverse('fetch_weather'), {'city': 'Mumbai'})
    
    # React redirect
    assert response.status_code == 302
    assert response.url == '/?city=Mumbai'

