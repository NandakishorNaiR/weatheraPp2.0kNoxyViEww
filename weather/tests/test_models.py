import pytest
from weather.models import Weather

@pytest.mark.django_db
def test_weather_model_creation() -> None:
    # Create database entry
    record = Weather.objects.create(
        city="Mumbai",
        temperature=27,
        description="Clear Sky",
        humidity=68,
        pressure=1013,
        real_feel=30,
        wind_direction="SouthEast",
        sunrise="06:08 AM",
        is_daytime=True
    )
    
    # Assert persistence
    assert Weather.objects.count() == 1
    retrieved = Weather.objects.first()
    assert retrieved is not None
    assert retrieved.city == "Mumbai"
    assert retrieved.temperature == 27
    assert str(retrieved) == "Mumbai @ 27°C"
