import json
import os
import subprocess
import time
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional, Tuple

from models import db, McpServer, McpToolConfig, generate_uuid, current_alpaca_timestamp


class McpManager:
    """
    Manages communication with Model Context Protocol (MCP) servers via SSE/HTTP transport.
    Handles discovery, tool synchronization, format conversion for Ollama/OpenAI, and tool execution.
    """

    @staticmethod
    def _send_sse_rpc(url: str, request_payload: Dict[str, Any], env_vars: Dict[str, str], timeout: int = 15) -> Dict[str, Any]:
        """
        Sends a JSON-RPC 2.0 request to an MCP server endpoint.
        Handles standard SSE endpoints (GET /sse -> event: endpoint -> POST /messages)
        as well as direct HTTP JSON-RPC endpoints.
        """
        import threading
        import urllib.parse
        import urllib.request
        import urllib.error

        headers = {"Accept": "text/event-stream, application/json"}
        if env_vars:
            if "AUTHORIZATION" in env_vars:
                headers["Authorization"] = env_vars["AUTHORIZATION"]
            elif "API_KEY" in env_vars:
                headers["Authorization"] = f"Bearer {env_vars['API_KEY']}"
            for k, v in env_vars.items():
                if k not in ("AUTHORIZATION", "API_KEY") and isinstance(k, str) and isinstance(v, str):
                    headers[k] = v

        parsed_url = urllib.parse.urlparse(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

        msg_endpoint = None
        response_box = {}
        error_box = {}
        stop_event = threading.Event()

        def sse_listener():
            nonlocal msg_endpoint
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    content_type = resp.headers.get("content-type", "")
                    if "text/event-stream" not in content_type and "application/json" in content_type:
                        # Direct HTTP response
                        body = resp.read().decode("utf-8")
                        try:
                            data = json.loads(body)
                            response_box["direct"] = data
                        except Exception as e:
                            error_box["error"] = str(e)
                        return

                    current_event = None
                    for raw_line in resp:
                        if stop_event.is_set():
                            break
                        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
                        if line.startswith("event:"):
                            current_event = line[6:].strip()
                        elif line.startswith("data:"):
                            data_str = line[5:].strip()
                            if current_event == "endpoint":
                                msg_endpoint = urllib.parse.urljoin(base_url, data_str)
                            elif current_event == "message":
                                try:
                                    parsed = json.loads(data_str)
                                    if isinstance(parsed, dict) and "id" in parsed:
                                        response_box[parsed["id"]] = parsed
                                except Exception:
                                    pass
                        elif not line:
                            current_event = None
            except Exception as e:
                error_box["listener"] = str(e)

        listener_thread = threading.Thread(target=sse_listener, daemon=True)
        listener_thread.start()

        # Wait to discover endpoint or receive direct response
        start_wait = time.time()
        while time.time() - start_wait < min(4.0, timeout):
            if msg_endpoint or "direct" in response_box or "listener" in error_box:
                break
            time.sleep(0.05)

        if "direct" in response_box:
            data = response_box["direct"]
            if isinstance(data, dict):
                if "error" in data:
                    raise RuntimeError(str(data["error"]))
                return data.get("result", data)
            return {}

        if not msg_endpoint:
            # Fallback to direct POST if GET was not an SSE stream
            post_headers = headers.copy()
            post_headers["Content-Type"] = "application/json"
            post_req = urllib.request.Request(
                url,
                data=json.dumps(request_payload).encode("utf-8"),
                headers=post_headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(post_req, timeout=timeout) as resp:
                    body = resp.read().decode("utf-8", errors="replace")
                    data = json.loads(body)
                    if isinstance(data, dict):
                        if "error" in data:
                            raise RuntimeError(str(data["error"]))
                        return data.get("result", data)
                    return {}
            except Exception as e:
                stop_event.set()
                err_detail = error_box.get("listener", str(e))
                raise RuntimeError(f"Failed to communicate with MCP server ({url}): {err_detail}")

        # Standard SSE flow
        post_headers = headers.copy()
        post_headers["Content-Type"] = "application/json"

        def post_rpc(endpoint: str, payload: dict):
            p_req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=post_headers,
                method="POST",
            )
            with urllib.request.urlopen(p_req, timeout=timeout) as p_resp:
                return p_resp.status

        # 1. Initialize
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "Walpaca", "version": "1.0"},
            },
        }
        try:
            post_rpc(msg_endpoint, init_req)
        except Exception as e:
            stop_event.set()
            raise RuntimeError(f"MCP initialize request failed: {str(e)}")

        # Wait for initialize response
        init_start = time.time()
        while time.time() - init_start < timeout:
            if 1 in response_box:
                break
            time.sleep(0.05)

        # 2. Notifications/initialized
        try:
            notif_req = {"jsonrpc": "2.0", "method": "notifications/initialized"}
            post_rpc(msg_endpoint, notif_req)
        except Exception:
            pass

        # 3. Target Request
        target_id = request_payload.get("id", 2)
        try:
            post_rpc(msg_endpoint, request_payload)
        except Exception as e:
            stop_event.set()
            raise RuntimeError(f"MCP target request failed: {str(e)}")

        # Wait for target response
        target_start = time.time()
        while time.time() - target_start < timeout:
            if target_id in response_box:
                break
            time.sleep(0.05)

        stop_event.set()

        if target_id in response_box:
            resp = response_box[target_id]
            if "error" in resp:
                err_obj = resp["error"]
                err_msg = err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
                raise RuntimeError(f"MCP Error: {err_msg}")
            return resp.get("result", {})

        raise TimeoutError(f"MCP request timed out waiting for response (id={target_id})")

    @classmethod
    def test_connection(cls, server: McpServer) -> Tuple[bool, str]:
        """Test connection to an MCP server and query tools."""
        try:
            tools = cls.fetch_server_tools(server)
            return True, f"Successfully connected. Discovered {len(tools)} tool(s)."
        except Exception as e:
            return False, str(e)

    @classmethod
    def fetch_server_tools(cls, server: McpServer) -> List[Dict[str, Any]]:
        """Queries the MCP server for its supported tools via `tools/list`."""
        if not server.url:
            raise ValueError("Endpoint URL is required for SSE/HTTP MCP server")

        req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }

        result = cls._send_sse_rpc(
            url=server.url,
            request_payload=req,
            env_vars=server.get_env(),
        )

        tools = result.get("tools", [])
        return tools if isinstance(tools, list) else []

    @classmethod
    def sync_server_tools(cls, server_id: str) -> List[McpToolConfig]:
        """
        Discovers tools from the MCP server and upserts them into `McpToolConfig`.
        """
        server = db.session.get(McpServer, server_id)
        if not server:
            raise ValueError(f"Server {server_id} not found")

        raw_tools = cls.fetch_server_tools(server)
        discovered_names = set()

        for t in raw_tools:
            name = t.get("name")
            if not name:
                continue
            discovered_names.add(name)
            desc = t.get("description", "")
            schema = t.get("inputSchema") or t.get("schema") or {"type": "object", "properties": {}}

            tool_record = McpToolConfig.query.filter_by(server_id=server.id, name=name).first()
            if tool_record:
                tool_record.description = desc
                tool_record.set_schema(schema)
            else:
                tool_record = McpToolConfig(
                    id=generate_uuid(),
                    server_id=server.id,
                    name=name,
                    description=desc,
                    is_enabled=1,
                    requires_approval=0,
                )
                tool_record.set_schema(schema)
                db.session.add(tool_record)

        # Remove tools no longer reported by server
        McpToolConfig.query.filter(
            McpToolConfig.server_id == server.id,
            ~McpToolConfig.name.in_(discovered_names)
        ).delete(synchronize_session=False)

        server.updated_at = current_alpaca_timestamp()
        db.session.commit()

        return McpToolConfig.query.filter_by(server_id=server.id).all()

    @classmethod
    def call_tool(cls, server_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calls a specific tool on the given MCP server.
        """
        server = db.session.get(McpServer, server_id)
        if not server:
            raise ValueError(f"McpServer {server_id} not found")

        if not server.url:
            raise ValueError("Endpoint URL is required for SSE/HTTP MCP server")

        req = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000) % 1000000,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments or {},
            },
        }

        result = cls._send_sse_rpc(
            url=server.url,
            request_payload=req,
            env_vars=server.get_env(),
        )

        return result

    @classmethod
    def get_enabled_tools(cls) -> List[Tuple[McpServer, McpToolConfig]]:
        """Returns all enabled tools from enabled servers."""
        servers = McpServer.query.filter_by(is_enabled=1).all()
        active = []
        for s in servers:
            for t in s.tools:
                if t.is_enabled:
                    active.append((s, t))
        return active

    @classmethod
    def to_ollama_tools(cls, tool_tuples: List[Tuple[McpServer, McpToolConfig]]) -> List[Dict[str, Any]]:
        """
        Converts MCP tools to Ollama tool calling format:
        [
            {
                "type": "function",
                "function": {
                    "name": "...",
                    "description": "...",
                    "parameters": { ... }
                }
            }
        ]
        """
        tools_list = []
        for server, tool in tool_tuples:
            schema = tool.get_schema()
            tools_list.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or f"Tool provided by {server.name}",
                    "parameters": schema if isinstance(schema, dict) and schema else {
                        "type": "object",
                        "properties": {},
                    },
                },
            })
        return tools_list

    @classmethod
    def to_openai_tools(cls, tool_tuples: List[Tuple[McpServer, McpToolConfig]]) -> List[Dict[str, Any]]:
        """
        Converts MCP tools to OpenAI / Gemini / OpenRouter standard function format.
        """
        return cls.to_ollama_tools(tool_tuples)
