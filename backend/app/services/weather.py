"""Forecast lookup via Open-Meteo (free, no API key). Failures degrade gracefully."""
import logging

import httpx

from ..schemas import WeatherDay

log = logging.getLogger("construction_ai")

WMO = {0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
       51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain",
       65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
       81: "Heavy showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm with hail",
       99: "Severe thunderstorm with hail"}


def fetch_forecast(location: str, days: int = 3) -> dict | None:
    """Return {"location": str, "days": [WeatherDay dict]} or None if unavailable."""
    try:
        with httpx.Client(timeout=8.0) as http:
            geo = http.get("https://geocoding-api.open-meteo.com/v1/search",
                           params={"name": location, "count": 1}).json()
            hit = (geo.get("results") or [None])[0]
            if not hit:
                return None
            fc = http.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": hit["latitude"], "longitude": hit["longitude"], "timezone": "auto",
                "forecast_days": days,
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
            }).json()["daily"]
        out = []
        for i, date in enumerate(fc["time"]):
            out.append(WeatherDay(
                date=date, temp_max_c=fc["temperature_2m_max"][i], temp_min_c=fc["temperature_2m_min"][i],
                precipitation_mm=fc["precipitation_sum"][i] or 0, wind_max_kmh=fc["wind_speed_10m_max"][i],
                summary=WMO.get(fc["weather_code"][i], "Unknown")).model_dump())
        place = ", ".join(p for p in (hit.get("name"), hit.get("admin1"), hit.get("country")) if p)
        return {"location": place, "days": out}
    except Exception as e:  # weather is optional: any failure falls back to general advice
        log.warning("weather lookup failed for %r: %s", location, e)
        return None
