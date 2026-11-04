import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("Weather-Server", host="0.0.0.0", port=8080)

USER_AGENT = "AlpacaBot/1.0 (+https://github.com/Jeffser/Alpaca)"

# WMO Weather interpretation codes (WW) to human-readable description
WMO_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    62: "Moderate rain",
    63: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def get_weather_description(code: int) -> str:
    """Map WMO code to human-readable weather description."""
    return WMO_CODE_MAP.get(code, f"Unknown ({code})")


async def geocode_location(location: str, client: httpx.AsyncClient) -> dict:
    """Geocode a city or place name into latitude, longitude, and display label."""
    loc_clean = (location or "").strip()
    if not loc_clean:
        raise ValueError("Location name cannot be empty.")

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": loc_clean, "count": 1, "language": "en", "format": "json"}
    resp = await client.get(url, params=params, timeout=10.0)
    if resp.status_code != 200:
        raise RuntimeError(f"Geocoding service returned status {resp.status_code}")

    data = resp.json()
    results = data.get("results")
    if not results or len(results) == 0:
        raise ValueError(f"Could not find coordinates for location '{loc_clean}'.")

    match = results[0]
    name = match.get("name", loc_clean)
    country = match.get("country", "")
    admin1 = match.get("admin1", "")
    label_parts = [p for p in (name, admin1, country) if p]
    display_name = ", ".join(label_parts)

    return {
        "name": display_name,
        "latitude": match["latitude"],
        "longitude": match["longitude"],
        "timezone": match.get("timezone", "auto"),
    }


@mcp.tool()
async def get_current_weather(
    location: str,
    temperature_unit: str = "celsius",
) -> str:
    """
    Get the live current weather conditions for any city or location.
    Args:
        location: The name of the city, town, or location (e.g. 'Tokyo', 'London', 'San Francisco').
        temperature_unit: Temperature scale to return, either 'celsius' or 'fahrenheit' (default 'celsius').
    """
    temp_unit = "fahrenheit" if (temperature_unit or "").strip().lower() == "fahrenheit" else "celsius"
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            geo = await geocode_location(location, client)
            lat = geo["latitude"]
            lon = geo["longitude"]

            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                "temperature_unit": temp_unit,
                "wind_speed_unit": "kmh" if temp_unit == "celsius" else "mph",
                "precipitation_unit": "mm" if temp_unit == "celsius" else "inch",
                "timezone": "auto",
            }

            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return f"Weather API error ({resp.status_code}) fetching weather for {geo['name']}."

            data = resp.json()
            curr = data.get("current", {})
            units = data.get("current_units", {})

            temp = curr.get("temperature_2m", "N/A")
            temp_u = units.get("temperature_2m", "°C")
            feels_like = curr.get("apparent_temperature", "N/A")
            humidity = curr.get("relative_humidity_2m", "N/A")
            humidity_u = units.get("relative_humidity_2m", "%")
            precip = curr.get("precipitation", "0")
            precip_u = units.get("precipitation", "mm")
            wind = curr.get("wind_speed_10m", "N/A")
            wind_u = units.get("wind_speed_10m", "km/h")
            code = curr.get("weather_code", -1)
            desc = get_weather_description(code)

            return (
                f"Weather for: {geo['name']}\n"
                f"Coordinates: {lat:.4f}°N, {lon:.4f}°E\n"
                f"Condition: {desc}\n"
                f"Temperature: {temp} {temp_u} (Feels like: {feels_like} {temp_u})\n"
                f"Humidity: {humidity}{humidity_u}\n"
                f"Precipitation: {precip} {precip_u}\n"
                f"Wind Speed: {wind} {wind_u}\n"
            )
    except Exception as e:
        return f"Error retrieving current weather: {str(e)}"


@mcp.tool()
async def get_weather_forecast(
    location: str,
    days: int = 3,
    temperature_unit: str = "celsius",
) -> str:
    """
    Get a multi-day weather forecast for any city or location (up to 7 days).
    Args:
        location: The name of the city, town, or location (e.g. 'Paris', 'Berlin').
        days: Number of forecast days to return (1 to 7, default 3).
        temperature_unit: Temperature scale to return, either 'celsius' or 'fahrenheit' (default 'celsius').
    """
    temp_unit = "fahrenheit" if (temperature_unit or "").strip().lower() == "fahrenheit" else "celsius"
    num_days = max(1, min(7, int(days)))
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            geo = await geocode_location(location, client)
            lat = geo["latitude"]
            lon = geo["longitude"]

            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
                "temperature_unit": temp_unit,
                "precipitation_unit": "mm" if temp_unit == "celsius" else "inch",
                "timezone": "auto",
            }

            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return f"Weather API error ({resp.status_code}) fetching forecast for {geo['name']}."

            data = resp.json()
            daily = data.get("daily", {})
            units = data.get("daily_units", {})

            dates = daily.get("time", [])[:num_days]
            codes = daily.get("weather_code", [])[:num_days]
            t_max = daily.get("temperature_2m_max", [])[:num_days]
            t_min = daily.get("temperature_2m_min", [])[:num_days]
            precip_sums = daily.get("precipitation_sum", [])[:num_days]
            precip_probs = daily.get("precipitation_probability_max", [])[:num_days]

            temp_u = units.get("temperature_2m_max", "°C")
            precip_u = units.get("precipitation_sum", "mm")

            lines = [
                f"Forecast for: {geo['name']} ({len(dates)} days)",
                f"Coordinates: {lat:.4f}°N, {lon:.4f}°E",
                "---",
            ]

            for i, date in enumerate(dates):
                desc = get_weather_description(codes[i] if i < len(codes) else -1)
                max_val = t_max[i] if i < len(t_max) else "N/A"
                min_val = t_min[i] if i < len(t_min) else "N/A"
                p_sum = precip_sums[i] if i < len(precip_sums) else 0
                p_prob = precip_probs[i] if i < len(precip_probs) else "N/A"
                lines.append(
                    f"- {date}: {desc} | Min: {min_val}{temp_u}, Max: {max_val}{temp_u} | Precip: {p_sum} {precip_u} ({p_prob}% chance)"
                )

            return "\n".join(lines)
    except Exception as e:
        return f"Error retrieving weather forecast: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="sse")

