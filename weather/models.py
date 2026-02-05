from django.db import models


class Weather(models.Model):
    city = models.CharField(max_length=200)
    temperature = models.IntegerField()
    description = models.CharField(max_length=255)
    humidity = models.IntegerField(null=True, blank=True)
    pressure = models.IntegerField(null=True, blank=True)
    real_feel = models.IntegerField(null=True, blank=True)
    wind_direction = models.CharField(max_length=50, null=True, blank=True)
    sunrise = models.CharField(max_length=50, null=True, blank=True)
    is_daytime = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.city} @ {self.temperature}°C"
