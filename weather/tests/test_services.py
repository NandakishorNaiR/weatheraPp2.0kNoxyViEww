import pytest
from weather.services.aqi_service import calculate_aqi, get_final_aqi, get_aqi_category, PM25_INDIAN_BREAKPOINTS
from weather.utils import map_weather_to_badge, get_wind_direction, get_local_time, is_daytime


def test_calculate_aqi_values() -> None:
    # CPCB: PM2.5 range (0 to 30) maps to AQI (0 to 50)
    # 15 should map exactly to 25
    val = calculate_aqi(15.0, PM25_INDIAN_BREAKPOINTS)
    assert val == 25

    # CPCB: PM2.5 range (30.1 to 60.0) maps to AQI (51 to 100)
    # 45 should map exactly to 75
    val2 = calculate_aqi(45.0, PM25_INDIAN_BREAKPOINTS)
    assert val2 == 75

    # Invalid concentration should return None
    assert calculate_aqi("invalid", PM25_INDIAN_BREAKPOINTS) is None
    assert calculate_aqi(None, PM25_INDIAN_BREAKPOINTS) is None


def test_get_final_aqi() -> None:
    # With valid PM2.5 and PM10, maximum sub-index is used
    # PM2.5 of 15 maps to 25 sub-index
    # PM10 of 75 maps to 75 sub-index (CPCB range 50.1-100.0 maps to AQI 51-100)
    # Final AQI should be 75
    aqi = get_final_aqi(pm25=15, pm10=75)
    assert aqi == 75

    # If no values are passed, returns None
    assert get_final_aqi() is None


def test_get_aqi_category() -> None:
    # Good
    label, desc = get_aqi_category(30)
    assert label == "Good"
    
    # Satisfactory
    label2, desc2 = get_aqi_category(75)
    assert label2 == "Satisfactory"

    # Moderate
    label3, desc3 = get_aqi_category(150)
    assert label3 == "Moderate"

    # Poor
    label4, desc4 = get_aqi_category(250)
    assert label4 == "Poor"

    # Very Poor
    label5, desc5 = get_aqi_category(350)
    assert label5 == "Very Poor"

    # Severe
    label6, desc6 = get_aqi_category(450)
    assert label6 == "Severe"

    # Error
    label7, desc7 = get_aqi_category(None)
    assert label7 == "Unknown"


def test_utils_map_weather_to_badge() -> None:
    # Clear Day
    badge = map_weather_to_badge("Clear", "clear sky", True)
    assert badge["type"] == "clear"
    assert badge["icon"] == "fa-sun"

    # Cloudy Night
    badge2 = map_weather_to_badge("Clouds", "few clouds", False)
    assert badge2["type"] == "cloudy"
    assert badge2["icon"] == "fa-cloud-moon"


def test_utils_wind_direction() -> None:
    assert get_wind_direction(0) == "North"
    assert get_wind_direction(90) == "East"
    assert get_wind_direction(180) == "South"
    assert get_wind_direction(270) == "West"
    assert get_wind_direction(None) == "N/A"
