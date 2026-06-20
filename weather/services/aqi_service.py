from typing import List, Tuple, Optional

# ------------------ AQI (Indian CPCB) Breakpoint Tables ------------------
PM25_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 30.0, 0, 50),
    (30.1, 60.0, 51, 100),
    (60.1, 90.0, 101, 200),
    (90.1, 120.0, 201, 300),
    (120.1, 250.0, 301, 400),
    (250.1, 99999.0, 401, 500),
]

PM10_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 50.0, 0, 50),
    (50.1, 100.0, 51, 100),
    (100.1, 250.0, 101, 200),
    (250.1, 350.0, 201, 300),
    (350.1, 430.0, 301, 400),
    (430.1, 99999.0, 401, 500),
]

NO2_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 40.0, 0, 50),
    (40.1, 80.0, 51, 100),
    (80.1, 180.0, 101, 200),
    (181.1, 280.0, 201, 300),
    (280.1, 400.0, 301, 400),
    (400.1, 99999.0, 401, 500),
]

SO2_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 40.0, 0, 50),
    (40.1, 80.0, 51, 100),
    (80.1, 380.0, 101, 200),
    (380.1, 800.0, 201, 300),
    (800.1, 1600.0, 301, 400),
    (1600.1, 99999.0, 401, 500),
]

CO_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 1.0, 0, 50),
    (1.01, 2.0, 51, 100),
    (2.01, 10.0, 101, 200),
    (10.01, 17.0, 201, 300),
    (17.01, 34.0, 301, 400),
    (34.01, 99999.0, 401, 500),
]

O3_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 50.0, 0, 50),
    (50.1, 100.0, 51, 100),
    (100.1, 168.0, 101, 200),
    (168.1, 208.0, 201, 300),
    (208.1, 748.0, 301, 400),
    (748.1, 99999.0, 401, 500),
]

NH3_INDIAN_BREAKPOINTS: List[Tuple[float, float, int, int]] = [
    (0.0, 200.0, 0, 50),
    (200.1, 400.0, 51, 100),
    (400.1, 800.0, 101, 200),
    (801.0, 1200.0, 201, 300),
    (1201.0, 1800.0, 301, 400),
    (1801.0, 99999.0, 401, 500),
]


def calculate_aqi(concentration: Optional[float], breakpoints: List[Tuple[float, float, int, int]]) -> Optional[int]:
    """Calculate the sub-index for a specific pollutant using CPCB breakpoints."""
    if concentration is None:
        return None
    try:
        concentration = float(concentration)
    except Exception:
        return None

    for bp_low, bp_high, aqi_low, aqi_high in breakpoints:
        if bp_low <= concentration <= bp_high:
            return round(((aqi_high - aqi_low) / (bp_high - bp_low)) * (concentration - bp_low) + aqi_low)
    return None


def get_final_aqi(
    pm25: Optional[float] = None,
    pm10: Optional[float] = None,
    no2: Optional[float] = None,
    so2: Optional[float] = None,
    co: Optional[float] = None,
    o3: Optional[float] = None,
    nh3: Optional[float] = None,
) -> Optional[int]:
    """Calculate the final CPCB AQI based on the maximum sub-index of available pollutants."""
    aqi_values: List[int] = []
    
    if pm25 is not None:
        a = calculate_aqi(pm25, PM25_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if pm10 is not None:
        a = calculate_aqi(pm10, PM10_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if no2 is not None:
        a = calculate_aqi(no2, NO2_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if so2 is not None:
        a = calculate_aqi(so2, SO2_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if co is not None:
        a = calculate_aqi(co, CO_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if o3 is not None:
        a = calculate_aqi(o3, O3_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)
    if nh3 is not None:
        a = calculate_aqi(nh3, NH3_INDIAN_BREAKPOINTS)
        if a is not None:
            aqi_values.append(a)

    if not aqi_values:
        return None
    return min(max(aqi_values), 500)


def get_aqi_category(aqi: Optional[float]) -> Tuple[str, str]:
    """Retrieve CPCB category label and health implication text based on AQI value."""
    if aqi is None:
        return ("Unknown", "AQI unavailable")
    try:
        aqi = float(aqi)
    except Exception:
        return ("Unknown", "AQI unavailable")

    if aqi <= 50:
        return ("Good", "Minimal impact. Satisfactory air quality.")
    elif aqi <= 100:
        return ("Satisfactory", "May cause minor breathing discomfort to sensitive people.")
    elif aqi <= 200:
        return ("Moderate", "May cause breathing discomfort to people with lung, asthma, and heart diseases.")
    elif aqi <= 300:
        return ("Poor", "May cause breathing discomfort to most people on prolonged exposure.")
    elif aqi <= 400:
        return ("Very Poor", "May cause respiratory illness to people on prolonged exposure.")
    else:
        return ("Severe", "May cause respiratory effects even on healthy people and serious health impacts.")
