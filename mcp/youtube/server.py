import re
from urllib.parse import parse_qs, urlparse
import httpx
from mcp.server.fastmcp import FastMCP
from youtube_transcript_api import YouTubeTranscriptApi

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("YouTube-Transcript-Server", host="0.0.0.0", port=8080)

VIDEO_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def extract_video_id(url_or_id: str) -> str:
    """Extract and validate an 11-character YouTube video ID from a URL or raw ID."""
    candidate = (url_or_id or "").strip()
    if VIDEO_ID_REGEX.match(candidate):
        return candidate

    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()

    if host in ("youtu.be", "www.youtu.be"):
        video_id = parsed.path.lstrip("/").split("/")[0]
        if VIDEO_ID_REGEX.match(video_id):
            return video_id

    if host.endswith("youtube.com") or host.endswith("youtube-nocookie.com"):
        if parsed.path == "/watch":
            qs = parse_qs(parsed.query)
            video_id = (qs.get("v") or [""])[0]
            if VIDEO_ID_REGEX.match(video_id):
                return video_id
        for prefix in ("/shorts/", "/embed/", "/v/", "/live/"):
            if parsed.path.startswith(prefix):
                video_id = parsed.path[len(prefix):].split("/")[0]
                if VIDEO_ID_REGEX.match(video_id):
                    return video_id

    raise ValueError(f"Could not extract a valid 11-character YouTube video ID from: '{url_or_id}'")


def format_timestamp(seconds: float) -> str:
    """Format seconds into [MM:SS] or [HH:MM:SS]."""
    total_seconds = max(0, int(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"[{hours:02d}:{minutes:02d}:{secs:02d}]"
    return f"[{minutes:02d}:{secs:02d}]"


async def fetch_video_metadata(video_id: str) -> dict:
    """Fetch basic YouTube video metadata (title, author) via noembed."""
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    noembed_url = f"https://noembed.com/embed?url={watch_url}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(noembed_url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "title": data.get("title") or "Unknown Title",
                    "author": data.get("author_name") or "Unknown Channel",
                    "url": watch_url,
                }
    except Exception:
        pass
    return {"title": "YouTube Video", "author": "Unknown Channel", "url": watch_url}


def fetch_transcript_segments(video_id: str, lang_list: list[str]) -> tuple[list[dict], str]:
    """
    Fetch transcript segments supporting both youtube-transcript-api >=1.0.0 and 0.x.
    Falls back to any available transcript if preferred languages are not found.
    """
    if hasattr(YouTubeTranscriptApi, "fetch"):
        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            try:
                transcript = transcript_list.find_transcript(lang_list)
            except Exception:
                transcript = next(iter(transcript_list))
            fetched = transcript.fetch()
            lang_label = f"{getattr(transcript, 'language', 'unknown')} ({getattr(transcript, 'language_code', '')})"
            segments = [
                {
                    "text": getattr(item, "text", "") if not isinstance(item, dict) else item.get("text", ""),
                    "start": float(getattr(item, "start", 0.0) if not isinstance(item, dict) else item.get("start", 0.0)),
                    "duration": float(getattr(item, "duration", 0.0) if not isinstance(item, dict) else item.get("duration", 0.0)),
                }
                for item in fetched
            ]
            return segments, lang_label
        except TypeError:
            pass

    transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
    try:
        transcript = transcript_list.find_transcript(lang_list)
    except Exception:
        transcript = next(iter(transcript_list))
    raw = transcript.fetch()
    lang_label = f"{getattr(transcript, 'language', 'unknown')} ({getattr(transcript, 'language_code', '')})"
    segments = [
        {
            "text": item.get("text", "") if isinstance(item, dict) else getattr(item, "text", ""),
            "start": float(item.get("start", 0.0) if isinstance(item, dict) else getattr(item, "start", 0.0)),
            "duration": float(item.get("duration", 0.0) if isinstance(item, dict) else getattr(item, "duration", 0.0)),
        }
        for item in raw
    ]
    return segments, lang_label


@mcp.tool()
async def get_youtube_transcript(
    url_or_id: str,
    languages: str = "en",
    include_timestamps: bool = False,
) -> str:
    """
    Fetch the transcript/captions and metadata of a YouTube video from its URL or video ID.
    Args:
        url_or_id: Full YouTube URL (watch, youtu.be, shorts, embed) or 11-char video ID.
        languages: Comma-separated preferred language codes (e.g. 'en,es,pt'). Falls back to available language.
        include_timestamps: Whether to prefix each transcript line with [MM:SS] timestamps.
    """
    try:
        video_id = extract_video_id(url_or_id)
        lang_list = [lang.strip() for lang in (languages or "en").split(",") if lang.strip()] or ["en"]
        meta = await fetch_video_metadata(video_id)
        segments, lang_label = fetch_transcript_segments(video_id, lang_list)

        if not segments:
            return f"No transcript segments found for video {video_id}."

        header = (
            f"Title: {meta['title']}\n"
            f"Channel: {meta['author']}\n"
            f"URL: {meta['url']}\n"
            f"Language: {lang_label}\n"
            f"---\n"
        )

        if include_timestamps:
            body = "\n".join(
                f"{format_timestamp(seg['start'])} {seg['text'].strip()}"
                for seg in segments
                if seg["text"].strip()
            )
        else:
            body = " ".join(seg["text"].strip() for seg in segments if seg["text"].strip())

        return header + body
    except Exception as e:
        return f"Error fetching YouTube transcript: {str(e)}"


@mcp.tool()
async def query_youtube_transcript(
    url_or_id: str,
    query: str,
    languages: str = "en",
    context_window: int = 2,
) -> str:
    """
    Search a YouTube video's transcript for specific keywords or phrases and return matching timestamped excerpts.
    Args:
        url_or_id: Full YouTube URL or 11-char video ID.
        query: Keyword or phrase to search inside the transcript.
        languages: Comma-separated preferred language codes (e.g. 'en,es,pt').
        context_window: Number of surrounding transcript segments to include before and after each match.
    """
    try:
        video_id = extract_video_id(url_or_id)
        lang_list = [lang.strip() for lang in (languages or "en").split(",") if lang.strip()] or ["en"]
        meta = await fetch_video_metadata(video_id)
        segments, lang_label = fetch_transcript_segments(video_id, lang_list)

        if not segments:
            return f"No transcript segments found for video {video_id}."

        search_term = (query or "").strip().lower()
        if not search_term:
            return await get_youtube_transcript(url_or_id, languages=languages, include_timestamps=True)

        win = max(0, min(10, int(context_window)))
        matched_indices = [
            idx for idx, seg in enumerate(segments) if search_term in seg["text"].lower()
        ]

        header = (
            f"Title: {meta['title']}\n"
            f"Channel: {meta['author']}\n"
            f"URL: {meta['url']}\n"
            f"Language: {lang_label}\n"
            f"Query: '{query}' (Matches: {len(matched_indices)})\n"
            f"---\n"
        )

        if not matched_indices:
            preview = " ".join(seg["text"].strip() for seg in segments[:40] if seg["text"].strip())
            return (
                header
                + f"No exact matches found for '{query}'. Beginning of transcript:\n{preview}"
            )

        excerpts = []
        for match_num, idx in enumerate(matched_indices[:25], start=1):
            start_idx = max(0, idx - win)
            end_idx = min(len(segments), idx + win + 1)
            chunk = "\n".join(
                f"  {format_timestamp(segments[i]['start'])} {segments[i]['text'].strip()}"
                for i in range(start_idx, end_idx)
            )
            excerpts.append(f"Match {match_num} (at {format_timestamp(segments[idx]['start'])}):\n{chunk}")

        return header + "\n\n".join(excerpts)
    except Exception as e:
        return f"Error querying YouTube transcript: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="sse")

