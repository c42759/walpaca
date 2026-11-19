import os
import re
import subprocess
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("Linux-Utils-Server", host="0.0.0.0", port=8080)

# --- Security & Output Configuration ---
# Restrict ripgrep searches to these directories only (colon-separated, read-only host mounts)
ALLOWED_SEARCH_ROOTS = [
    Path(p).expanduser().resolve()
    for p in os.getenv("SEARCH_ROOTS", "/host/home").split(":")
    if p.strip()
]
MAX_OUTPUT_CHARS = 15_000
UNIT_NAME_RE = re.compile(r"^[a-zA-Z0-9@_.:\-]+$")

# Never expose credential stores / secret files to the LLM
SEARCH_EXCLUDE_GLOBS = [
    "!.ssh/**",
    "!.gnupg/**",
    "!.password-store/**",
    "!.aws/**",
    "!.kube/**",
    "!.docker/config.json",
    "!**/.env",
    "!**/.env.*",
    "!**/*.pem",
    "!**/*.key",
    "!**/id_rsa*",
    "!**/id_ed25519*",
]


def _run_cmd(cmd: list[str], timeout: int = 10) -> str:
    """Safely execute a command without a shell and truncate oversized output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,  # Handle non-zero exit codes gracefully (e.g., rg no-match = 1)
        )
    except FileNotFoundError:
        return f"Error: '{cmd[0]}' is not installed or not in PATH."
    except subprocess.TimeoutExpired:
        return f"Error: Command '{cmd[0]}' timed out after {timeout}s."

    output = result.stdout.strip()
    if result.stderr.strip():
        output = f"{output}\n[stderr]: {result.stderr.strip()}".strip()

    if not output:
        return f"Command completed with no output (exit code {result.returncode})."

    if len(output) > MAX_OUTPUT_CHARS:
        return output[:MAX_OUTPUT_CHARS] + "\n... [output truncated]"
    return output


def _validate_unit(unit: str) -> str | None:
    """Ensure systemd unit names contain only safe characters."""
    if not unit or not UNIT_NAME_RE.match(unit) or unit.startswith("-"):
        return f"Error: Invalid unit name '{unit}'."
    return None


def _resolve_safe_path(directory: str) -> Path | None:
    """Resolve a path and verify it lives inside ALLOWED_SEARCH_ROOTS."""
    try:
        target = Path(directory).expanduser().resolve()
    except OSError:
        return None

    for root in ALLOWED_SEARCH_ROOTS:
        if target == root or root in target.parents:
            return target
    return None


# --- MCP Tools ---

@mcp.tool()
def get_hardware_info() -> str:
    """Get structured host hardware, OS, kernel, CPU, GPU, and memory info via fastfetch (JSON)."""
    return _run_cmd(["fastfetch", "--format", "json"])


@mcp.tool()
def get_storage_info() -> str:
    """List host block devices, partitions, filesystems, sizes, and mount points via lsblk (JSON)."""
    return _run_cmd(["lsblk", "-J", "--fs", "-o", "NAME,SIZE,TYPE,FSTYPE,LABEL,FSUSE%,FSAVAIL,MOUNTPOINTS"])


@mcp.tool()
def get_sensors() -> str:
    """Read live host hardware temperatures, voltages, and fan speeds via lm-sensors (JSON)."""
    return _run_cmd(["sensors", "-j"])


@mcp.tool()
def check_systemd_services(unit: str = "") -> str:
    """
    Check host systemd services.
    Args:
        unit: Optional unit name (e.g. 'docker.service'). Leave empty to list all failed services.
    """
    unit = (unit or "").strip()
    if not unit:
        return _run_cmd(["systemctl", "list-units", "--failed", "--no-pager"])

    if err := _validate_unit(unit):
        return err

    return _run_cmd(["systemctl", "status", "--no-pager", "--", unit])


@mcp.tool()
def get_service_logs(unit: str, lines: int = 50) -> str:
    """
    Fetch recent host journalctl logs for a specific systemd unit.
    Args:
        unit: Systemd unit name (e.g. 'docker.service').
        lines: Number of most recent log lines to return (1 to 200, default 50).
    """
    unit = (unit or "").strip()
    if err := _validate_unit(unit):
        return err

    try:
        safe_lines = max(1, min(int(lines), 200))
    except (TypeError, ValueError):
        safe_lines = 50

    return _run_cmd(
        ["journalctl", "-u", unit, "-n", str(safe_lines), "--no-pager"]
    )


@mcp.tool()
def search_files(pattern: str, directory: str = "") -> str:
    """
    Search host file contents using ripgrep within allowed read-only directories.
    Respects .gitignore, skips binary files, and never searches credential/secret files.
    Args:
        pattern: Regex or literal text to search for.
        directory: Optional sub-directory inside an allowed root (defaults to first allowed root).
    """
    if not (pattern or "").strip():
        return "Error: Search pattern cannot be empty."

    default_root = str(ALLOWED_SEARCH_ROOTS[0]) if ALLOWED_SEARCH_ROOTS else ""
    target_dir = _resolve_safe_path((directory or "").strip() or default_root)
    if not target_dir or not target_dir.is_dir():
        return (
            f"Error: Directory '{directory}' does not exist or is outside "
            f"allowed roots ({[str(p) for p in ALLOWED_SEARCH_ROOTS]})."
        )

    cmd = [
        "rg",
        "--line-number",
        "--no-heading",
        "--max-count",
        "10",
        "--max-filesize",
        "2M",
    ]
    for glob in SEARCH_EXCLUDE_GLOBS:
        cmd.extend(["--glob", glob])
    # '--' prevents patterns starting with '-' from being parsed as flags
    cmd.extend(["--", pattern, str(target_dir)])

    return _run_cmd(cmd, timeout=15)


if __name__ == "__main__":
    mcp.run(transport="sse")
