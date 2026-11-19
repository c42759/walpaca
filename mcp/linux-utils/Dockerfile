FROM python:3.11-slim

WORKDIR /app

# Host inspection binaries (Debian 13 trixie packages)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fastfetch \
        ripgrep \
        lm-sensors \
        systemd \
        util-linux \
    && rm -rf /var/lib/apt/lists/*

# Pin mcp to v1.x for FastMCP compatibility
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY server.py /app/server.py

EXPOSE 8080

CMD ["python", "server.py"]
