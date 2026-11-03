from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server (container-internal SSE port 8080)
# TODO(security): Binds 0.0.0.0 inside container for Docker bridge port forwarding; restrict host exposure via docker-compose port mapping.
mcp = FastMCP("Memory-Server", host="0.0.0.0", port=8080)

MEMORY_BASE_DIR = Path(
    os.environ.get("MEMORY_DATA_DIR", Path(__file__).resolve().parent / "data")
).resolve()

# Strict pattern for Folder UUIDs (supports standard 36-char UUIDs, Walpaca 52-char timestamp UUIDs, or 'default')
UUID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")
_FILE_LOCK = threading.Lock()


def sanitize_folder_uuid(folder_uuid: str) -> str:
    """
    Validate and normalize the folder UUID to prevent path traversal or cross-folder leakage.
    """
    candidate = (folder_uuid or "").strip()
    if not candidate:
        raise ValueError("Missing folder_uuid parameter.")
    if candidate.startswith("folder_"):
        candidate = candidate[len("folder_"):]
    if not UUID_PATTERN.match(candidate) or ".." in candidate:
        raise ValueError(
            "Invalid folder_uuid format. Only alphanumeric, hyphen, and underscore characters are allowed."
        )
    return candidate.lower()


def get_memory_file_path(folder_uuid: str) -> Path:
    """
    Translate a validated Folder UUID into its isolated directory and JSON file path:
    <MEMORY_BASE_DIR>/folder_<uuid>/memory.json
    """
    clean_uuid = sanitize_folder_uuid(folder_uuid)
    folder_dir = (MEMORY_BASE_DIR / f"folder_{clean_uuid}").resolve()

    # Enforce strict containment inside MEMORY_BASE_DIR
    if MEMORY_BASE_DIR not in folder_dir.parents and folder_dir != MEMORY_BASE_DIR:
        raise ValueError("Security violation: resolved path escapes memory base directory.")

    return folder_dir / "memory.json"


def normalize_entity_key(entity: str) -> str:
    """Normalize entity into a lowercase key while collapsing extra whitespace."""
    return " ".join((entity or "").strip().split()).lower()


def normalize_relation_key(relation: str) -> str:
    """Normalize relation into snake_case lowercase key."""
    cleaned = " ".join((relation or "").strip().split()).lower()
    cleaned = re.sub(r"[\s\-]+", "_", cleaned)
    return cleaned


def load_knowledge_graph(file_path: Path, folder_uuid: str) -> dict:
    """Load the scoped JSON knowledge graph from disk, or initialize an empty structure."""
    if not file_path.exists():
        return {
            "folder_uuid": sanitize_folder_uuid(folder_uuid),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "entities": {},
        }
    try:
        with file_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("Corrupted knowledge graph root")
            if not isinstance(data.get("entities"), dict):
                data["entities"] = {}
            return data
    except Exception:
        return {
            "folder_uuid": sanitize_folder_uuid(folder_uuid),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "entities": {},
        }


def save_knowledge_graph(file_path: Path, graph: dict) -> None:
    """Atomically write the updated knowledge graph JSON to the isolated folder directory."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    graph["updated_at"] = datetime.now(timezone.utc).isoformat()

    fd, tmp_path = tempfile.mkstemp(
        dir=str(file_path.parent), prefix=".memory_", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            json.dump(graph, tmp_file, indent=2, ensure_ascii=False)
            tmp_file.write("\n")
        os.replace(tmp_path, file_path)
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise


def score_fact_relevance(
    query: str,
    entity_key: str,
    display_name: str,
    relation: str,
    value: str,
) -> float:
    """
    Compute a local keyword and semantic/fuzzy similarity score between the query
    and a (Entity, Relation, Value) triple.
    """
    q = " ".join((query or "").strip().split()).lower()
    if not q or q in ("*", "all", "everything"):
        return 1.0

    relation_spaced = relation.replace("_", " ").lower()
    val_lower = (value or "").lower()
    disp_lower = (display_name or entity_key).lower()
    combined_text = f"{disp_lower} {relation_spaced} {val_lower}"

    score = 0.0

    # 1. Exact phrase / substring match
    if q in disp_lower:
        score += 3.0
    if q in relation_spaced or q in relation.lower():
        score += 2.5
    if q in val_lower:
        score += 2.0
    if q in combined_text:
        score += 1.5

    # 2. Token-level keyword & prefix/stem overlap
    stop_words = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "what",
        "who",
        "where",
        "when",
        "how",
        "about",
        "of",
        "for",
        "to",
        "in",
        "on",
        "my",
        "our",
    }
    raw_tokens = [tok for tok in re.findall(r"[a-z0-9_]+", q) if tok]
    query_tokens = [t for t in raw_tokens if t not in stop_words] or raw_tokens
    fact_tokens = set(re.findall(r"[a-z0-9]+", combined_text))

    if query_tokens:
        matched_tokens = 0.0
        for q_tok in query_tokens:
            if q_tok in fact_tokens:
                matched_tokens += 1.0
            elif any(
                q_tok in f_tok or f_tok in q_tok
                for f_tok in fact_tokens
                if len(f_tok) >= 3 and len(q_tok) >= 3
            ):
                matched_tokens += 0.75
            else:
                best_ratio = max(
                    (
                        SequenceMatcher(None, q_tok, f_tok).ratio()
                        for f_tok in fact_tokens
                    ),
                    default=0.0,
                )
                if best_ratio >= 0.75:
                    matched_tokens += best_ratio * 0.6
        score += (matched_tokens / len(query_tokens)) * 2.5

    # 3. Sequence similarity on entity/relation
    ent_ratio = SequenceMatcher(None, q, disp_lower).ratio()
    rel_ratio = SequenceMatcher(None, q, relation_spaced).ratio()
    if max(ent_ratio, rel_ratio) >= 0.65:
        score += max(ent_ratio, rel_ratio)

    return score


@mcp.tool()
async def store_fact(
    entity: str,
    relation: str,
    value: str,
    folder_uuid: str = "default",
) -> str:
    """
    Store or update a persistent fact in the workspace's isolated Local Knowledge Graph.
    Invoke this tool when the user shares persistent constraints, system preferences,
    personal facts, or project details meant to outlive the current chat context.

    Args:
        entity: The central subject or noun (e.g., "PostgreSQL", "Sister", "Project Alpha").
        relation: The logical bridge connecting the entity to its details (e.g., "is_used_as_database", "likes_to_read", "project_deadline").
        value: The concrete fact or target value assigned to that relation (e.g., "v16 Production Server", "Sci-Fi Novels", "December 1st").
        folder_uuid: Automatically injected workspace Folder UUID isolating memory scope.
    """
    try:
        display_name = " ".join((entity or "").strip().split())
        entity_key = normalize_entity_key(entity)
        relation_key = normalize_relation_key(relation)
        target_value = (value or "").strip()

        if not entity_key:
            return "Error storing fact: 'entity' cannot be empty."
        if not relation_key:
            return "Error storing fact: 'relation' cannot be empty."
        if not target_value:
            return "Error storing fact: 'value' cannot be empty."

        file_path = get_memory_file_path(folder_uuid)

        with _FILE_LOCK:
            graph = load_knowledge_graph(file_path, folder_uuid)
            entities = graph.setdefault("entities", {})

            if entity_key not in entities or not isinstance(entities[entity_key], dict):
                entities[entity_key] = {
                    "display_name": display_name,
                    "relations": {},
                }
            else:
                # Preserve or update user's intended capitalization as Display Name
                entities[entity_key]["display_name"] = display_name
                if not isinstance(entities[entity_key].get("relations"), dict):
                    entities[entity_key]["relations"] = {}

            previous_value = entities[entity_key]["relations"].get(relation_key)
            entities[entity_key]["relations"][relation_key] = target_value
            save_knowledge_graph(file_path, graph)

        action = "Updated" if previous_value is not None else "Stored"
        return (
            f"{action} fact in isolated memory:\n"
            f"- Entity: {display_name} (key: '{entity_key}')\n"
            f"- Relation: {relation_key}\n"
            f"- Value: {target_value}"
        )
    except Exception as e:
        return f"Error storing fact: {str(e)}"


@mcp.tool()
async def recall_facts(
    query: str = "",
    folder_uuid: str = "default",
) -> str:
    """
    Retrieve relevant facts from the workspace's isolated Local Knowledge Graph.
    Invoke this tool when the user asks a contextual question that relies on long-term
    memory, preferences, or background knowledge established in past interactions.

    Args:
        query: Keyword, entity name, relation, or question topic to search across stored facts. Leave empty to list all facts in the current workspace scope.
        folder_uuid: Automatically injected workspace Folder UUID isolating memory scope.
    """
    try:
        file_path = get_memory_file_path(folder_uuid)

        with _FILE_LOCK:
            if not file_path.exists():
                return "No stored facts found in this workspace memory."
            graph = load_knowledge_graph(file_path, folder_uuid)

        entities = graph.get("entities") or {}
        if not entities:
            return "No stored facts found in this workspace memory."

        scored_matches = []
        all_facts = []

        for entity_key, entity_data in entities.items():
            if not isinstance(entity_data, dict):
                continue
            display_name = entity_data.get("display_name") or entity_key
            relations = entity_data.get("relations") or {}
            if not isinstance(relations, dict):
                continue

            for rel_key, target_val in relations.items():
                fact_entry = (display_name, rel_key, str(target_val))
                all_facts.append(fact_entry)
                score = score_fact_relevance(
                    query=query,
                    entity_key=entity_key,
                    display_name=display_name,
                    relation=rel_key,
                    value=str(target_val),
                )
                if score > 0:
                    scored_matches.append((score, fact_entry))

        if not all_facts:
            return "No stored facts found in this workspace memory."

        if scored_matches:
            scored_matches.sort(
                key=lambda item: (-item[0], item[1][0].lower(), item[1][1])
            )
            lines = [
                f"- {disp} -> [{rel}]: {val}"
                for _, (disp, rel, val) in scored_matches
            ]
            header = (
                f"Recalled {len(lines)} matching fact(s) for query '{query}':"
                if (query or "").strip()
                else f"Recalled all {len(lines)} fact(s) in workspace memory:"
            )
            return header + "\n" + "\n".join(lines)

        # Fallback: if query had no direct keyword hit, return full scoped summary so Jarvis has context
        lines = [f"- {disp} -> [{rel}]: {val}" for disp, rel, val in all_facts]
        return (
            f"No exact keyword matches for '{query}'. Showing all {len(lines)} fact(s) in current workspace memory:\n"
            + "\n".join(lines)
        )
    except Exception as e:
        return f"Error recalling facts: {str(e)}"


if __name__ == "__main__":
    # FastMCP handles uvicorn and the SSE transport out of the box
    mcp.run(transport="sse")
