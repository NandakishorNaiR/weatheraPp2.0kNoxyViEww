from datetime import datetime, timedelta
from typing import Dict, Any, Optional

def map_weather_to_badge(weather_main: Optional[str], description: Optional[str], is_daytime: bool) -> Dict[str, str]:
    """
    Return a simple badge dict with icon, label and color for UI display.
    Uses FontAwesome icon names.
    """
    desc: str = (description or "").lower()
    main: str = (weather_main or "").lower()

    # Defaults
    icon: str = "fa-sun"
    label: str = description or (weather_main or "Unknown")
    color: str = "#f59e0b" if is_daytime else "#94a3b8"
    btype: str = "default"

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


def get_wind_direction(degree: Optional[float]) -> str:
    """Convert wind direction degree into string directions."""
    if degree is None:
        return "N/A"
    directions = [
        "North", "NorthEast", "East", "SouthEast",
        "South", "SouthWest", "West", "NorthWest"
    ]
    return directions[int((degree / 45) + 0.5) % 8]


def get_local_time(timestamp: int, offset: int) -> str:
    """Convert timestamp and timezone offset into readable string."""
    return (datetime.utcfromtimestamp(timestamp + offset)).strftime("%I:%M %p")


def is_daytime(offset: int) -> bool:
    """Determine if it is daytime based on timezone offset."""
    local_hour = (datetime.utcnow() + timedelta(seconds=offset)).hour
    return 6 <= local_hour < 18
