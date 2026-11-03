FROM python:3.11-slim

WORKDIR /app

# Pin mcp to v1.x for FastMCP compatibility
RUN pip install --no-cache-dir "mcp<2" uvicorn starlette sse-starlette

COPY server.py /app/server.py

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["python", "server.py"]

