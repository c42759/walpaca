import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

_TMP_ROOT = tempfile.mkdtemp()
os.environ["SEARCH_ROOTS"] = _TMP_ROOT

import server  # noqa: E402


def _ok(stdout="ok", stderr="", code=0):
    return MagicMock(stdout=stdout, stderr=stderr, returncode=code)


class TestLinuxUtilsServer(unittest.TestCase):
    def test_validate_unit(self):
        self.assertIsNone(server._validate_unit("docker.service"))
        self.assertIsNone(server._validate_unit("user@1000.service"))
        for bad in ("", "-H", "foo;rm", "a b", "x$(id)"):
            self.assertIsNotNone(server._validate_unit(bad), bad)

    def test_resolve_safe_path(self):
        root = Path(_TMP_ROOT).resolve()
        sub = root / "proj"
        sub.mkdir(exist_ok=True)
        self.assertEqual(server._resolve_safe_path(str(sub)), sub)
        self.assertIsNone(server._resolve_safe_path(str(root / ".." / "..")))
        self.assertIsNone(server._resolve_safe_path("/etc"))

    @patch("server.subprocess.run")
    def test_check_systemd_services(self, mock_run):
        mock_run.return_value = _ok()
        server.check_systemd_services("")
        self.assertEqual(mock_run.call_args[0][0], ["systemctl", "list-units", "--failed", "--no-pager"])
        server.check_systemd_services("docker.service")
        self.assertEqual(mock_run.call_args[0][0], ["systemctl", "status", "--no-pager", "--", "docker.service"])
        self.assertIn("Invalid unit", server.check_systemd_services("bad;unit"))

    @patch("server.subprocess.run")
    def test_get_service_logs_clamps_lines(self, mock_run):
        mock_run.return_value = _ok()
        for given, expected in ((0, "1"), (999, "200"), ("abc", "50"), (20, "20")):
            server.get_service_logs("docker.service", given)
            cmd = mock_run.call_args[0][0]
            self.assertEqual(cmd[cmd.index("-n") + 1], expected)

    @patch("server.subprocess.run")
    def test_search_files(self, mock_run):
        mock_run.return_value = _ok("a.txt:1:hit")
        self.assertIn("cannot be empty", server.search_files("  "))
        self.assertIn("outside", server.search_files("x", "/etc"))
        server.search_files("-rf")
        cmd = mock_run.call_args[0][0]
        for glob in server.SEARCH_EXCLUDE_GLOBS:
            self.assertIn(glob, cmd)
        dash = cmd.index("--")
        self.assertEqual(cmd[dash + 1], "-rf")
        self.assertEqual(cmd[dash + 2], str(Path(_TMP_ROOT).resolve()))

    @patch("server.subprocess.run")
    def test_run_cmd_errors_and_truncation(self, mock_run):
        mock_run.side_effect = FileNotFoundError()
        self.assertIn("not installed", server._run_cmd(["nope"]))
        mock_run.side_effect = subprocess.TimeoutExpired("rg", 1)
        self.assertIn("timed out", server._run_cmd(["rg"]))
        mock_run.side_effect = None
        mock_run.return_value = _ok("x" * (server.MAX_OUTPUT_CHARS + 10))
        self.assertTrue(server._run_cmd(["cat"]).endswith("[output truncated]"))


if __name__ == "__main__":
    unittest.main()
