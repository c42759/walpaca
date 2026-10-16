from flask import Blueprint, request, jsonify
from models import db, McpServer, McpToolConfig, generate_uuid, current_alpaca_timestamp
from utils.mcp_manager import McpManager

mcp_bp = Blueprint("mcp", __name__, url_prefix="/mcp")


@mcp_bp.route("/servers", methods=["GET"])
def list_servers():
    """List all configured MCP servers."""
    servers = McpServer.query.order_by(McpServer.created_at.asc()).all()
    return jsonify([s.to_dict(include_tools=True) for s in servers]), 200


@mcp_bp.route("/servers", methods=["POST"])
def create_server():
    """Create a new MCP server configuration."""
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Server name is required"}), 400

    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "SSE/HTTP endpoint URL is required"}), 400

    transport_type = data.get("transport_type", "sse")

    server = McpServer(
        id=generate_uuid(),
        name=name,
        description=data.get("description", ""),
        is_enabled=1 if data.get("is_enabled", True) else 0,
        transport_type=transport_type,
        command=data.get("command"),
        url=url,
        created_at=current_alpaca_timestamp(),
        updated_at=current_alpaca_timestamp(),
    )
    if "args" in data:
        server.set_args(data["args"])
    if "env" in data:
        server.set_env(data["env"])

    db.session.add(server)
    db.session.commit()

    # Attempt initial sync if enabled
    auto_sync = data.get("auto_sync", True)
    if auto_sync and server.is_enabled:
        try:
            McpManager.sync_server_tools(server.id)
        except Exception:
            pass

    return jsonify(server.to_dict(include_tools=True)), 201


@mcp_bp.route("/servers/<server_id>", methods=["GET"])
def get_server(server_id):
    """Retrieve a single MCP server with its tools."""
    server = db.session.get(McpServer, server_id)
    if not server:
        return jsonify({"error": "Server not found"}), 404
    return jsonify(server.to_dict(include_tools=True)), 200


@mcp_bp.route("/servers/<server_id>", methods=["PUT"])
def update_server(server_id):
    """Update an MCP server configuration."""
    server = db.session.get(McpServer, server_id)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    data = request.json or {}
    if "name" in data:
        server.name = str(data["name"]).strip()
    if "description" in data:
        server.description = str(data["description"]).strip()
    if "is_enabled" in data:
        server.is_enabled = 1 if data["is_enabled"] else 0
    if "transport_type" in data:
        server.transport_type = data["transport_type"]
    if "command" in data:
        server.command = data["command"]
    if "url" in data:
        server.url = data["url"]
    if "args" in data:
        server.set_args(data["args"])
    if "env" in data:
        server.set_env(data["env"])

    server.updated_at = current_alpaca_timestamp()
    db.session.commit()

    if data.get("auto_sync", False) and server.is_enabled:
        try:
            McpManager.sync_server_tools(server.id)
        except Exception:
            pass

    return jsonify(server.to_dict(include_tools=True)), 200


@mcp_bp.route("/servers/<server_id>", methods=["DELETE"])
def delete_server(server_id):
    """Delete an MCP server and its tool configurations."""
    server = db.session.get(McpServer, server_id)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    db.session.delete(server)
    db.session.commit()
    return jsonify({"message": f"Server {server_id} deleted successfully"}), 200


@mcp_bp.route("/servers/<server_id>/test", methods=["POST"])
def test_server(server_id):
    """Test connection to an MCP server."""
    server = db.session.get(McpServer, server_id)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    ok, msg = McpManager.test_connection(server)
    if ok:
        return jsonify({"status": "success", "message": msg}), 200
    else:
        return jsonify({"status": "error", "message": msg}), 400


@mcp_bp.route("/servers/<server_id>/sync", methods=["POST"])
def sync_server(server_id):
    """Sync tools from the MCP server into the database."""
    server = db.session.get(McpServer, server_id)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    try:
        tools = McpManager.sync_server_tools(server_id)
        return jsonify({
            "status": "success",
            "count": len(tools),
            "tools": [t.to_dict() for t in tools],
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@mcp_bp.route("/tools", methods=["GET"])
def list_tools():
    """List all tools across servers."""
    server_id = request.args.get("server_id")
    enabled_only = request.args.get("enabled_only", "false").lower() == "true"

    query = McpToolConfig.query
    if server_id:
        query = query.filter_by(server_id=server_id)
    if enabled_only:
        query = query.filter_by(is_enabled=1)

    tools = query.all()
    return jsonify([t.to_dict() for t in tools]), 200


@mcp_bp.route("/tools/<tool_id>", methods=["PUT"])
def update_tool(tool_id):
    """Update tool configuration (toggle enable or approval requirements)."""
    tool = db.session.get(McpToolConfig, tool_id)
    if not tool:
        return jsonify({"error": "Tool not found"}), 404

    data = request.json or {}
    if "is_enabled" in data:
        tool.is_enabled = 1 if data["is_enabled"] else 0
    if "requires_approval" in data:
        tool.requires_approval = 1 if data["requires_approval"] else 0

    db.session.commit()
    return jsonify(tool.to_dict()), 200


@mcp_bp.route("/execute", methods=["POST"])
def execute_tool():
    """Directly test-execute a tool from backend."""
    data = request.json or {}
    server_id = data.get("server_id")
    tool_name = data.get("name") or data.get("tool_name")
    arguments = data.get("arguments", {})

    if not server_id or not tool_name:
        return jsonify({"error": "server_id and name are required"}), 400

    try:
        result = McpManager.call_tool(server_id, tool_name, arguments)
        return jsonify({"status": "success", "result": result}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
