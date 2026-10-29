FROM python:3.11-slim

WORKDIR /app

# Pin mcp to v1.x for FastMCP compatibility
RUN pip install --no-cache-dir "mcp<2" httpx uvicorn starlette sse-starlette beautifulsoup4 html2text

COPY server.py /app/server.py

EXPOSE 8080

CMD ["python", "server.py"]

