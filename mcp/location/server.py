import ipaddress
import math
import os
from typing import Callable, Awaitable
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("Location-Server", host="0.0.0.0", port=8080)

USER_AGENT = "AlpacaBot/1.0 (+https://github.com/Jeffser/Alpaca)"

AUTO_IP_ALIASES = {"", "auto", "self", "me", "current", "my", "localhost"}


def normalize_target_ip(ip_address: str) -> str:
    """Normalize optional IP input; returns '' for auto-detection on empty/self/private IPs."""
    candidate = (ip_address or "").strip()
    if candidate.lower() in AUTO_IP_ALIASES:
        return ""

    try:
        ip_obj = ipaddress.ip_address(candidate)
    except ValueError as exc:
        raise ValueError(
            f"Invalid IP address '{candidate}'. Provide a valid IPv4/IPv6 address or leave empty for current location."
        ) from exc

    if (
        ip_obj.is_loopback
        or ip_obj.is_private
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
        or ip_obj.is_reserved
    ):
        return ""

    return str(ip_obj)


def _env_override_location() -> dict | None:
    """Return optional static location configured via DEFAULT_LOCATION_* env vars."""
    city = (os.getenv("DEFAULT_LOCATION_CITY") or "").strip()
    if not city:
        return None

    lat_raw = (os.getenv("DEFAULT_LOCATION_LAT") or "").strip()
    lon_raw = (os.getenv("DEFAULT_LOCATION_LON") or "").strip()
    lat = float(lat_raw) if lat_raw else None
    lon = float(lon_raw) if lon_raw else None

    return {
        "ip": (os.getenv("DEFAULT_LOCATION_IP") or "Configured Override").strip(),
        "city": city,
        "region": (os.getenv("DEFAULT_LOCATION_REGION") or "").strip(),
        "country": (os.getenv("DEFAULT_LOCATION_COUNTRY") or "").strip(),
        "country_code": (os.getenv("DEFAULT_LOCATION_COUNTRY_CODE") or "").strip(),
        "postal": (os.getenv("DEFAULT_LOCATION_POSTAL") or "").strip(),
        "latitude": lat,
        "longitude": lon,
        "timezone": (os.getenv("DEFAULT_LOCATION_TIMEZONE") or "auto").strip(),
        "isp": "Static Configuration",
        "source": "environment override",
    }


async def _lookup_ipwhois(client: httpx.AsyncClient, target_ip: str) -> dict:
    """Resolve IP geolocation via ipwho.is."""
    url = f"https://ipwho.is/{target_ip}" if target_ip else "https://ipwho.is/"
    resp = await client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"ipwho.is returned HTTP {resp.status_code}")

    data = resp.json()
    if not data.get("success", True):
        raise RuntimeError(data.get("message") or "ipwho.is lookup failed")

    tz_obj = data.get("timezone") if isinstance(data.get("timezone"), dict) else {}
    conn_obj = data.get("connection") if isinstance(data.get("connection"), dict) else {}

    return {
        "ip": data.get("ip", target_ip or "Unknown"),
        "city": data.get("city", ""),
        "region": data.get("region", ""),
        "country": data.get("country", ""),
        "country_code": data.get("country_code", ""),
        "postal": data.get("postal", ""),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "timezone": tz_obj.get("id", ""),
        "isp": conn_obj.get("isp") or conn_obj.get("org") or "",
        "source": "ipwho.is",
    }


async def _lookup_ip_api(client: httpx.AsyncClient, target_ip: str) -> dict:
    """Resolve IP geolocation via ip-api.com (HTTP free tier)."""
    url = f"http://ip-api.com/json/{target_ip}" if target_ip else "http://ip-api.com/json/"
    resp = await client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"ip-api.com returned HTTP {resp.status_code}")

    data = resp.json()
    if data.get("status") != "success":
        raise RuntimeError(data.get("message") or "ip-api.com lookup failed")

    return {
        "ip": data.get("query", target_ip or "Unknown"),
        "city": data.get("city", ""),
        "region": data.get("regionName", ""),
        "country": data.get("country", ""),
        "country_code": data.get("countryCode", ""),
        "postal": data.get("zip", ""),
        "latitude": data.get("lat"),
        "longitude": data.get("lon"),
        "timezone": data.get("timezone", ""),
        "isp": data.get("isp") or data.get("org") or "",
        "source": "ip-api.com",
    }


async def _lookup_ipapi_co(client: httpx.AsyncClient, target_ip: str) -> dict:
    """Resolve IP geolocation via ipapi.co."""
    url = f"https://ipapi.co/{target_ip}/json/" if target_ip else "https://ipapi.co/json/"
    resp = await client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"ipapi.co returned HTTP {resp.status_code}")

    data = resp.json()
    if data.get("error"):
        raise RuntimeError(data.get("reason") or "ipapi.co lookup failed")

    return {
        "ip": data.get("ip", target_ip or "Unknown"),
        "city": data.get("city", ""),
        "region": data.get("region", ""),
        "country": data.get("country_name", ""),
        "country_code": data.get("country_code", ""),
        "postal": data.get("postal", ""),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "timezone": data.get("timezone", ""),
        "isp": data.get("org", ""),
        "source": "ipapi.co",
    }


async def _lookup_freeipapi(client: httpx.AsyncClient, target_ip: str) -> dict:
    """Resolve IP geolocation via freeipapi.com."""
    url = f"https://freeipapi.com/api/json/{target_ip}" if target_ip else "https://freeipapi.com/api/json"
    resp = await client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"freeipapi.com returned HTTP {resp.status_code}")

    data = resp.json()
    if not data.get("countryName") and not data.get("cityName"):
        raise RuntimeError("freeipapi.com returned empty location data")

    tz_list = data.get("timeZones") if isinstance(data.get("timeZones"), list) else []
    tz_val = data.get("timeZone") or (tz_list[0] if tz_list else "")

    return {
        "ip": data.get("ipAddress", target_ip or "Unknown"),
        "city": data.get("cityName", ""),
        "region": data.get("regionName", ""),
        "country": data.get("countryName", ""),
        "country_code": data.get("countryCode", ""),
        "postal": data.get("zipCode", ""),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "timezone": tz_val,
        "isp": data.get("asnOrganization") or data.get("isp") or "",
        "source": "freeipapi.com",
    }


GEOIP_PROVIDERS: tuple[Callable[[httpx.AsyncClient, str], Awaitable[dict]], ...] = (
    _lookup_ipwhois,
    _lookup_ip_api,
    _lookup_ipapi_co,
    _lookup_freeipapi,
)


def _format_location_response(loc: dict) -> str:
    """Format normalized geolocation dict into an LLM-friendly text block."""
    country_label = loc.get("country") or ""
    if loc.get("country_code") and country_label:
        country_label = f"{country_label} ({loc['country_code']})"
    elif loc.get("country_code"):
        country_label = loc["country_code"]

    place_parts = [p for p in (loc.get("city"), loc.get("region"), country_label) if p]
    place_str = ", ".join(place_parts) or "Unknown"

    lat = loc.get("latitude")
    lon = loc.get("longitude")
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        coords_str = f"{lat:.4f}, {lon:.4f}"
    else:
        coords_str = "Unavailable"

    lines = [
        f"Location: {place_str}",
        f"Coordinates: {coords_str}",
        f"Timezone: {loc.get('timezone') or 'Unknown'}",
        f"Postal Code: {loc.get('postal') or 'N/A'}",
        f"Public IP: {loc.get('ip') or 'Unknown'}",
        f"ISP / Org: {loc.get('isp') or 'Unknown'}",
        f"Source: {loc.get('source') or 'GeoIP'}",
    ]
    return "\n".join(lines)


@mcp.tool()
async def get_current_location(ip_address: str = "") -> str:
    """
    Find the current geographic location (city, region, country, postal code, coordinates, timezone, and public IP).
    Leave ip_address empty to detect the server/user's current public location automatically, or pass a public IPv4/IPv6 address to locate that IP.
    Args:
        ip_address: Optional public IPv4/IPv6 address (leave empty or 'auto' for current location).
    """
    try:
        target_ip = normalize_target_ip(ip_address)
    except ValueError as e:
        return f"Error resolving location: {str(e)}"

    if not target_ip:
        override = _env_override_location()
        if override is not None:
            return _format_location_response(override)

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    errors = []

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        for provider in GEOIP_PROVIDERS:
            try:
                loc = await provider(client, target_ip)
                return _format_location_response(loc)
            except Exception as e:
                errors.append(f"{provider.__name__}: {str(e)}")

    return "Error retrieving current location from GeoIP providers: " + "; ".join(errors)


def _validate_coordinates(latitude: float, longitude: float) -> tuple[float, float]:
    """Validate geographic latitude and longitude ranges."""
    lat = float(latitude)
    lon = float(longitude)
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise ValueError("Latitude and longitude must be finite numbers.")
    if not (-90.0 <= lat <= 90.0):
        raise ValueError(f"Latitude {lat} out of valid range [-90, 90].")
    if not (-180.0 <= lon <= 180.0):
        raise ValueError(f"Longitude {lon} out of valid range [-180, 180].")
    return lat, lon


@mcp.tool()
async def reverse_geocode(latitude: float, longitude: float) -> str:
    """
    Convert geographic coordinates (latitude and longitude) into a street address, city, region, postal code, and country.
    Args:
        latitude: Latitude in decimal degrees (-90 to 90).
        longitude: Longitude in decimal degrees (-180 to 180).
    """
    try:
        lat, lon = _validate_coordinates(latitude, longitude)
    except (ValueError, TypeError) as e:
        return f"Invalid coordinates: {str(e)}"

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "format": "jsonv2",
        "lat": lat,
        "lon": lon,
        "accept-language": "en",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, headers=headers) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return f"Reverse geocoding API returned HTTP {resp.status_code}."

            data = resp.json()
            if data.get("error"):
                return f"Reverse geocoding error: {data['error']}"

            addr = data.get("address") if isinstance(data.get("address"), dict) else {}
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or addr.get("county")
                or ""
            )
            road_parts = [p for p in (addr.get("house_number"), addr.get("road")) if p]
            street = " ".join(road_parts)
            suburb = addr.get("suburb") or addr.get("neighbourhood") or ""
            state = addr.get("state") or addr.get("region") or ""
            postcode = addr.get("postcode") or ""
            country = addr.get("country") or ""

            lines = [
                f"Display Address: {data.get('display_name') or 'Unknown'}",
                f"Coordinates: {lat:.6f}, {lon:.6f}",
            ]
            if street:
                lines.append(f"Street: {street}")
            if suburb:
                lines.append(f"Neighborhood: {suburb}")
            if city:
                lines.append(f"City / Town: {city}")
            if state:
                lines.append(f"State / Region: {state}")
            if postcode:
                lines.append(f"Postal Code: {postcode}")
            if country:
                lines.append(f"Country: {country}")
            return "\n".join(lines)
    except Exception as e:
        return f"Error during reverse geocoding: {str(e)}"


@mcp.tool()
async def search_location(query: str, count: int = 5) -> str:
    """
    Search for a city, town, address, or landmark by name and return matching geographic coordinates, region, country, and timezone.
    Args:
        query: Place name, city, or address query (e.g. 'Kyoto', 'Eiffel Tower', 'Austin, TX').
        count: Maximum number of matches to return (1 to 10, default 5).
    """
    q_clean = (query or "").strip()
    if not q_clean:
        return "Error searching location: Search query cannot be empty."

    try:
        limit = max(1, min(10, int(count)))
    except (ValueError, TypeError):
        limit = 5

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=12.0, headers=headers) as client:
            om_url = "https://geocoding-api.open-meteo.com/v1/search"
            om_resp = await client.get(
                om_url,
                params={"name": q_clean, "count": limit, "language": "en", "format": "json"},
            )
            if om_resp.status_code == 200:
                results = om_resp.json().get("results") or []
                if results:
                    lines = [f"Location matches for '{q_clean}' ({len(results)}):"]
                    for idx, item in enumerate(results, start=1):
                        label_parts = [
                            p
                            for p in (item.get("name"), item.get("admin1"), item.get("country"))
                            if p
                        ]
                        label = ", ".join(label_parts) or q_clean
                        lat = item.get("latitude")
                        lon = item.get("longitude")
                        tz = item.get("timezone") or "Unknown"
                        elev = item.get("elevation")
                        elev_str = f" | Elevation: {elev}m" if elev is not None else ""
                        lines.append(
                            f"{idx}. {label} | Coordinates: {lat:.4f}, {lon:.4f} | Timezone: {tz}{elev_str}"
                        )
                    return "\n".join(lines)

            # Fallback to Nominatim for street addresses or landmarks
            nom_url = "https://nominatim.openstreetmap.org/search"
            nom_resp = await client.get(
                nom_url,
                params={
                    "q": q_clean,
                    "format": "jsonv2",
                    "limit": limit,
                    "accept-language": "en",
                    "addressdetails": 1,
                },
            )
            if nom_resp.status_code == 200:
                nom_results = nom_resp.json() or []
                if nom_results:
                    lines = [f"Location matches for '{q_clean}' ({len(nom_results)}):"]
                    for idx, item in enumerate(nom_results, start=1):
                        display = item.get("display_name") or q_clean
                        lat = float(item["lat"])
                        lon = float(item["lon"])
                        lines.append(f"{idx}. {display} | Coordinates: {lat:.6f}, {lon:.6f}")
                    return "\n".join(lines)

            return f"No locations found matching '{q_clean}'."
    except Exception as e:
        return f"Error searching location: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="sse")
