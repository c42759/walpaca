from mcp.server.fastmcp import FastMCP
import httpx

# Initialize FastMCP server
mcp = FastMCP("Fetch-SSE-Server", host="0.0.0.0", port=8080)

@mcp.tool()
async def fetch_web_page(url: str) -> str:
    """Fetch content from a URL and return it as text."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, follow_redirects=True)
            return response.text
        except Exception as e:
            return f"Error fetching URL: {str(e)}"

if __name__ == "__main__":
    # FastMCP handles uvicorn and the SSE transport out of the box
    mcp.run(transport="sse")
