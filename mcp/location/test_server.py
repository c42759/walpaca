import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import server


class TestLocationServer(unittest.IsolatedAsyncioTestCase):
    def test_normalize_target_ip(self):
        self.assertEqual(server.normalize_target_ip(""), "")
        self.assertEqual(server.normalize_target_ip("auto"), "")
        self.assertEqual(server.normalize_target_ip("self"), "")
        self.assertEqual(server.normalize_target_ip("127.0.0.1"), "")
        self.assertEqual(server.normalize_target_ip("192.168.1.42"), "")
        self.assertEqual(server.normalize_target_ip("8.8.8.8"), "8.8.8.8")
        with self.assertRaises(ValueError):
            server.normalize_target_ip("not-an-ip")

    async def test_get_current_location_fallback(self):
        mock_resp_fail = MagicMock(status_code=503)
        mock_resp_ok = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={
                    "status": "success",
                    "query": "203.0.113.10",
                    "city": "Seattle",
                    "regionName": "Washington",
                    "country": "United States",
                    "countryCode": "US",
                    "zip": "98101",
                    "lat": 47.6062,
                    "lon": -122.3321,
                    "timezone": "America/Los_Angeles",
                    "isp": "Example ISP",
                }
            ),
        )

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[mock_resp_fail, mock_resp_ok])
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("server.httpx.AsyncClient", return_value=mock_ctx):
            result = await server.get_current_location()

        self.assertIn("Location: Seattle, Washington, United States (US)", result)
        self.assertIn("Coordinates: 47.6062, -122.3321", result)
        self.assertIn("Timezone: America/Los_Angeles", result)
        self.assertIn("Public IP: 203.0.113.10", result)
        self.assertIn("Source: ip-api.com", result)

    async def test_get_current_location_env_override(self):
        env_vars = {
            "DEFAULT_LOCATION_CITY": "Austin",
            "DEFAULT_LOCATION_REGION": "Texas",
            "DEFAULT_LOCATION_COUNTRY": "United States",
            "DEFAULT_LOCATION_LAT": "30.2672",
            "DEFAULT_LOCATION_LON": "-97.7431",
            "DEFAULT_LOCATION_TIMEZONE": "America/Chicago",
        }
        with patch.dict("os.environ", env_vars, clear=False):
            result = await server.get_current_location()

        self.assertIn("Location: Austin, Texas, United States", result)
        self.assertIn("Coordinates: 30.2672, -97.7431", result)
        self.assertIn("Timezone: America/Chicago", result)
        self.assertIn("Source: environment override", result)

    async def test_reverse_geocode_validation_and_format(self):
        bad_lat = await server.reverse_geocode(95.0, 0.0)
        self.assertIn("Invalid coordinates", bad_lat)

        mock_resp = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={
                    "display_name": "1600 Amphitheatre Parkway, Mountain View, CA, US",
                    "address": {
                        "house_number": "1600",
                        "road": "Amphitheatre Parkway",
                        "city": "Mountain View",
                        "state": "California",
                        "postcode": "94043",
                        "country": "United States",
                    },
                }
            ),
        )
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("server.httpx.AsyncClient", return_value=mock_ctx):
            result = await server.reverse_geocode(37.422, -122.084)

        self.assertIn("Display Address: 1600 Amphitheatre Parkway", result)
        self.assertIn("City / Town: Mountain View", result)
        self.assertIn("Postal Code: 94043", result)

    async def test_search_location(self):
        empty_res = await server.search_location("   ")
        self.assertIn("cannot be empty", empty_res)

        mock_resp = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={
                    "results": [
                        {
                            "name": "Kyoto",
                            "admin1": "Kyoto",
                            "country": "Japan",
                            "latitude": 35.02107,
                            "longitude": 135.75385,
                            "timezone": "Asia/Tokyo",
                            "elevation": 56.0,
                        }
                    ]
                }
            ),
        )
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("server.httpx.AsyncClient", return_value=mock_ctx):
            result = await server.search_location("Kyoto", count=1)

        self.assertIn("Kyoto, Kyoto, Japan", result)
        self.assertIn("Coordinates: 35.0211, 135.7538", result)
        self.assertIn("Timezone: Asia/Tokyo", result)


if __name__ == "__main__":
    unittest.main()
