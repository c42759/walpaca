from mcp.server.fastmcp import FastMCP
import httpx
from ddgs import DDGS  # Clean import from the new package name

# Initialize FastMCP server
mcp = FastMCP("DuckDuckGo-Search-Server", host="0.0.0.0", port=8080)

@mcp.tool()
async def search_ddg(query: str, max_results: int = 5) -> str:
    """
    Search DuckDuckGo for the given query string.
    Returns a formatted list of search results including titles, snippets, and URLs.
    """
    try:
        # Using the context manager from the updated ddgs package
        with DDGS() as ddgs:
            # FIX: Changed 'keywords=' to 'query='
            results = list(ddgs.text(query=query, max_results=max_results))
            
        if not results:
            return f"No results found for query: '{query}'"
            
        # Format the results into an LLM-friendly text block
        formatted_results = []
        for i, res in enumerate(results, start=1):
            formatted_results.append(
                f"{i}. Title: {res.get('title')}\n"
                f"   URL: {res.get('href')}\n"
                f"   Snippet: {res.get('body')}\n"
            )
        return "\n".join(formatted_results)

    except Exception as e:
        return f"Error executing DuckDuckGo search: {str(e)}"

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
