import os
import re
import stat
import json
import tempfile
import threading

from pathlib import Path
from datetime import datetime
from datetime import timezone
from difflib import SequenceMatcher
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


def load_merged_entities(folder_uuid: str) -> dict:
    """
    Load entities for `folder_uuid`, inheriting global/root facts from 'default'
    (chats without a folder) while keeping folder-specific facts isolated and higher priority.
    """
    clean_uuid = sanitize_folder_uuid(folder_uuid)
    merged_entities: dict = {}

    # 1. Load root/unfoldered ('default') memory first as base knowledge
    default_path = get_memory_file_path("default")
    if default_path.exists():
        default_graph = load_knowledge_graph(default_path, "default")
        for ent_key, ent_data in (default_graph.get("entities") or {}).items():
            if isinstance(ent_data, dict):
                merged_entities[ent_key] = {
                    "display_name": ent_data.get("display_name") or ent_key,
                    "relations": dict(ent_data.get("relations") or {}),
                }

    # 2. Overlay folder-specific memory if operating inside a specific folder
    if clean_uuid != "default":
        folder_path = get_memory_file_path(clean_uuid)
        if folder_path.exists():
            folder_graph = load_knowledge_graph(folder_path, clean_uuid)
            for ent_key, ent_data in (folder_graph.get("entities") or {}).items():
                if not isinstance(ent_data, dict):
                    continue
                if ent_key not in merged_entities:
                    merged_entities[ent_key] = {
                        "display_name": ent_data.get("display_name") or ent_key,
                        "relations": dict(ent_data.get("relations") or {}),
                    }
                else:
                    if ent_data.get("display_name"):
                        merged_entities[ent_key]["display_name"] = ent_data["display_name"]
                    merged_entities[ent_key]["relations"].update(
                        ent_data.get("relations") or {}
                    )

    return merged_entities


def save_knowledge_graph(file_path: Path, graph: dict) -> None:
    """Atomically write the updated knowledge graph JSON while preserving file ownership and permissions."""
    parent_existed = file_path.parent.exists()
    file_path.parent.mkdir(parents=True, exist_ok=True)

    existing_stat = None
    if file_path.exists():
        try:
            existing_stat = file_path.stat()
        except OSError:
            existing_stat = None

    ref_stat = existing_stat
    if ref_stat is None:
        for candidate_dir in (file_path.parent, MEMORY_BASE_DIR):
            try:
                ref_stat = candidate_dir.stat()
                break
            except OSError:
                continue

    if not parent_existed and ref_stat is not None:
        try:
            os.chown(file_path.parent, ref_stat.st_uid, ref_stat.st_gid)
        except OSError:
            pass

    graph["updated_at"] = datetime.now(timezone.utc).isoformat()

    fd, tmp_path = tempfile.mkstemp(dir=str(file_path.parent),
                                    prefix=".memory_",
                                    suffix=".tmp")

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            json.dump(graph, tmp_file, indent=2, ensure_ascii=False)
            tmp_file.write("\n")

        target_mode = (
            stat.S_IMODE(existing_stat.st_mode)
            if existing_stat is not None
            else 0o644
        )
        os.chmod(tmp_path, target_mode)

        if ref_stat is not None:
            try:
                os.chown(tmp_path, ref_stat.st_uid, ref_stat.st_gid)
            except OSError:
                pass

        os.replace(tmp_path, file_path)
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise


def archive_to_trash(
    folder_dir: Path,
    folder_uuid: str,
    entity_key: str,
    display_name: str,
    removed_relations: dict,
    deleted_entire_entity: bool = False,
) -> Path:
    """
    Move removed entity/relations into `trash.json` alongside `memory.json`.
    If `trash.json` already contains a conflicting entry with the same entity/relation name,
    writes to a new versioned `trash_[timestamp].json` file instead.
    """
    trash_path = folder_dir / "trash.json"
    has_conflict = False

    if trash_path.exists():
        trash_graph = load_knowledge_graph(trash_path, folder_uuid)
        trash_entities = trash_graph.get("entities") or {}
        if entity_key in trash_entities and isinstance(trash_entities[entity_key], dict):
            existing_rels = trash_entities[entity_key].get("relations") or {}
            if deleted_entire_entity or any(rel in existing_rels for rel in removed_relations):
                has_conflict = True
    else:
        trash_graph = load_knowledge_graph(trash_path, folder_uuid)

    if has_conflict:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        versioned_path = folder_dir / f"trash_{ts}.json"
        counter = 1
        while versioned_path.exists():
            versioned_path = folder_dir / f"trash_{ts}_{counter}.json"
            counter += 1
        target_trash_path = versioned_path
        target_graph = {
            "folder_uuid": sanitize_folder_uuid(folder_uuid),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "entities": {
                entity_key: {
                    "display_name": display_name,
                    "relations": dict(removed_relations),
                }
            },
        }
    else:
        target_trash_path = trash_path
        target_graph = trash_graph
        entities = target_graph.setdefault("entities", {})
        if entity_key not in entities or not isinstance(entities[entity_key], dict):
            entities[entity_key] = {
                "display_name": display_name,
                "relations": dict(removed_relations),
            }
        else:
            entities[entity_key]["display_name"] = display_name
            if not isinstance(entities[entity_key].get("relations"), dict):
                entities[entity_key]["relations"] = {}
            entities[entity_key]["relations"].update(removed_relations)

    save_knowledge_graph(target_trash_path, target_graph)
    return target_trash_path


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
    ALWAYS invoke this tool IMMEDIATELY whenever the user shares ANY personal information
    (name, birthday, age, family, spouse, kids, routines, opinions), professional details
    (job, company, side hustle, projects, SaaS products), hardware/software specs, or preferences.
    You can call `store_fact` multiple times in a single turn to store multiple facts.
    NEVER tell the user you stored, saved, registered, or updated your memory without calling this tool.

    Args:
        entity: The central subject or noun (e.g., "User", "Carlos", "One:Shift", "PC Build").
        relation: The attribute or relationship (e.g., "full_name", "birthday", "profession", "wife", "kids", "current_saas_project").
        value: The concrete fact or value to store (e.g., "Carlos Miguel Pereira dos Santos", "28/10/1991", "OneStack").
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
    query: str,
    folder_uuid: str = "default",
) -> str:
    """
    ALWAYS invoke this tool FIRST when the user asks about their personal facts, hardware/PC specs,
    preferences, project details, or any information from previous conversations that is not present
    in the current chat history. Do NOT say you don't know or lack access without calling this tool first.

    Args:
        query: Keyword, entity name, topic, or question to search in memory (e.g., "PC Specs", "database", "all"). Pass "all" to retrieve all stored facts in this workspace.
        folder_uuid: Automatically injected workspace Folder UUID isolating memory scope.
    """
    try:
        with _FILE_LOCK:
            entities = load_merged_entities(folder_uuid)

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


@mcp.tool()
async def delete_fact(
    entity: str,
    relation: str = "",
    folder_uuid: str = "default",
) -> str:
    """
    Curate workspace memory by removing an outdated, duplicate, or incorrect fact (or entire entity)
    from `memory.json` and archiving it to `trash.json` (or `trash_[timestamp].json` on conflict).

    Args:
        entity: The entity name to curate or remove (e.g., "PC Build", "User").
        relation: Specific relation key to remove (e.g., "gpu", "birthday"). Leave empty or pass "*" / "all" to remove the entire entity and all its relations.
        folder_uuid: Automatically injected workspace Folder UUID isolating memory scope.
    """
    try:
        entity_key = normalize_entity_key(entity)
        raw_rel = (relation or "").strip()
        delete_all_relations = not raw_rel or raw_rel.lower() in ("*", "all")
        relation_key = "" if delete_all_relations else normalize_relation_key(raw_rel)

        if not entity_key:
            return "Error deleting fact: 'entity' cannot be empty."

        clean_uuid = sanitize_folder_uuid(folder_uuid)
        file_path = get_memory_file_path(clean_uuid)

        with _FILE_LOCK:
            # Check if entity/relation exists locally in this folder
            folder_entities = {}
            if file_path.exists():
                folder_graph = load_knowledge_graph(file_path, clean_uuid)
                folder_entities = folder_graph.get("entities") or {}

            has_local_entity = entity_key in folder_entities and isinstance(folder_entities[entity_key], dict)
            local_relations = folder_entities[entity_key].get("relations") or {} if has_local_entity else {}
            has_local_target = has_local_entity and (delete_all_relations or relation_key in local_relations)

            # If not in local folder, check if it exists in root default memory
            if not has_local_target and clean_uuid != "default":
                default_path = get_memory_file_path("default")
                if default_path.exists():
                    default_graph = load_knowledge_graph(default_path, "default")
                    default_entities = default_graph.get("entities") or {}
                    if entity_key in default_entities and isinstance(default_entities[entity_key], dict):
                        default_rels = default_entities[entity_key].get("relations") or {}
                        if delete_all_relations or relation_key in default_rels:
                            target_desc = f"entity '{entity}'" if delete_all_relations else f"relation '{relation_key}' under entity '{entity}'"
                            return (
                                f"Cannot delete {target_desc} from workspace folder '{clean_uuid}': "
                                f"this fact is inherited from global root memory ('default') which is read-only "
                                f"in folder chats. Global facts can only be modified or deleted from a root (unfoldered) chat."
                            )

            if not has_local_entity:
                if not file_path.exists():
                    return f"No memory file found for this workspace; nothing to delete for '{entity}'."
                return f"Entity '{entity}' (key: '{entity_key}') not found in workspace memory."

            graph = load_knowledge_graph(file_path, clean_uuid)
            entities = graph.get("entities") or {}

            if entity_key not in entities or not isinstance(entities[entity_key], dict):
                return f"Entity '{entity}' (key: '{entity_key}') not found in workspace memory."

            ent_obj = entities[entity_key]
            display_name = ent_obj.get("display_name") or entity.strip()
            relations = ent_obj.get("relations") or {}

            if delete_all_relations:
                removed_relations = dict(relations)
                del entities[entity_key]
                deleted_entire_entity = True
            else:
                if relation_key not in relations:
                    return (
                        f"Relation '{relation_key}' not found under entity '{display_name}'. "
                        f"Available relations: {', '.join(relations.keys()) or 'none'}."
                    )
                removed_relations = {relation_key: relations.pop(relation_key)}
                deleted_entire_entity = False
                if not relations:
                    del entities[entity_key]

            save_knowledge_graph(file_path, graph)
            trash_file = archive_to_trash(
                folder_dir=file_path.parent,
                folder_uuid=clean_uuid,
                entity_key=entity_key,
                display_name=display_name,
                removed_relations=removed_relations,
                deleted_entire_entity=deleted_entire_entity,
            )

        removed_summary = "\n".join(
            f"- {display_name} -> [{k}]: {v}" for k, v in removed_relations.items()
        )
        return (
            f"Moved {len(removed_relations)} fact(s) from memory.json to {trash_file.name}:\n"
            f"{removed_summary}"
        )
    except Exception as e:
        return f"Error deleting fact: {str(e)}"


if __name__ == "__main__":
    # FastMCP handles uvicorn and the SSE transport out of the box
    mcp.run(transport="sse")
