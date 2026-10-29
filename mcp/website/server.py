import ipaddress
import socket
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
import html2text
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("Website-Scraper-Server", host="0.0.0.0", port=8080)

USER_AGENT = "AlpacaBot/1.0 (+https://github.com/Jeffser/Alpaca)"


def validate_public_url(url: str) -> str:
    """Validate URL scheme and block loopback/link-local/private metadata targets (SSRF guard)."""
    candidate = (url or "").strip()
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http:// and https:// URLs are supported.")
    if not parsed.hostname:
        raise ValueError("Invalid URL: missing hostname.")

    hostname = parsed.hostname.lower()
    if hostname in ("localhost", "0.0.0.0"):
        raise ValueError("Access to localhost is not permitted.")

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast:
                raise ValueError(f"Access to restricted address ({ip_str}) is not permitted.")
    except socket.gaierror as e:
        raise ValueError(f"Could not resolve hostname '{hostname}': {str(e)}")

    return candidate


async def is_allowed_by_robots(url: str, client: httpx.AsyncClient) -> bool:
    """Check robots.txt permission for AlpacaBot, matching GTK Alpaca behavior."""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        resp = await client.get(robots_url, timeout=5.0)
        if resp.status_code == 200:
            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
            return rp.can_fetch("AlpacaBot", url) and rp.can_fetch("*", url)
    except Exception:
        pass
    return True


@mcp.tool()
async def scrape_website(
    url: str,
    include_links: bool = True,
    include_images: bool = False,
    respect_robots: bool = True,
    max_length: int = 20000,
) -> str:
    """
    Scrape a website URL, extract page metadata, strip scripts/styles, and convert content to clean Markdown.
    Args:
        url: The http/https URL of the webpage to scrape.
        include_links: Preserve hyperlinks in the Markdown output.
        include_images: Preserve image references in the Markdown output.
        respect_robots: Check robots.txt before scraping (default True).
        max_length: Maximum character length of returned Markdown content (default 20000).
    """
    try:
        target_url = validate_public_url(url)
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"}

        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0, headers=headers) as client:
            if respect_robots and not await is_allowed_by_robots(target_url, client):
                return f"Fetching this URL is disallowed by robots.txt: {target_url}"

            response = await client.get(target_url)
            if response.status_code != 200:
                return f"Failed to fetch the page ({response.status_code}): {target_url}"

            content_type = response.headers.get("content-type", "").lower()
            raw_text = response.text

        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            limit = max(1000, min(100000, int(max_length)))
            return f"URL: {target_url}\nContent-Type: {content_type}\n---\n{raw_text[:limit]}"

        soup = BeautifulSoup(raw_text, "html.parser")

        title = (soup.title.string.strip() if soup.title and soup.title.string else "") or target_url
        desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        description = desc_tag.get("content", "").strip() if desc_tag else ""

        for tag in soup(["script", "style", "noscript", "svg", "iframe", "canvas", "form"]):
            tag.decompose()

        converter = html2text.HTML2Text()
        converter.ignore_links = not include_links
        converter.ignore_images = not include_images
        converter.body_width = 0
        converter.ignore_emphasis = False

        markdown_body = converter.handle(str(soup)).strip()
        limit = max(1000, min(100000, int(max_length)))
        if len(markdown_body) > limit:
            markdown_body = markdown_body[:limit] + "\n\n...[Content truncated]..."

        header_lines = [f"Title: {title}", f"URL: {target_url}"]
        if description:
            header_lines.append(f"Description: {description}")
        header_lines.append("---")

        return "\n".join(header_lines) + "\n\n" + markdown_body
    except Exception as e:
        return f"Error scraping website: {str(e)}"


@mcp.tool()
async def extract_website_links(url: str, same_domain_only: bool = False) -> str:
    """
    Extract and list hyperlinks from a webpage URL.
    Args:
        url: The http/https URL of the webpage to inspect.
        same_domain_only: Only return links belonging to the same domain as the source URL.
    """
    try:
        target_url = validate_public_url(url)
        base_domain = (urlparse(target_url).hostname or "").lower()
        headers = {"User-Agent": USER_AGENT}

        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0, headers=headers) as client:
            response = await client.get(target_url)
            if response.status_code != 200:
                return f"Failed to fetch the page ({response.status_code}): {target_url}"

        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()
        links = []

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            full_url = urljoin(target_url, href)
            parsed_link = urlparse(full_url)
            if parsed_link.scheme not in ("http", "https"):
                continue
            if same_domain_only and (parsed_link.hostname or "").lower() != base_domain:
                continue
            if full_url in seen:
                continue
            seen.add(full_url)
            label = " ".join(a_tag.get_text().split()) or full_url
            links.append(f"{len(links) + 1}. [{label}]({full_url})")
            if len(links) >= 100:
                break

        if not links:
            return f"No links found on {target_url}."

        return f"Links extracted from {target_url} ({len(links)}):\n" + "\n".join(links)
    except Exception as e:
        return f"Error extracting links: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="sse")

