# A single chat with multiple Agents

## The Problem

At the moment we have to switch between chat sessions to talk to different agents. And we have to remember which agent we talked to last time. Also, we have to manually assign the roles to the agents.

## The Solution

We should be able to have a single chat session with multiple agents, where we can assign roles/personas to agents and switch between them.

## How it should work

We will use a single chat session, where the user can type a message and assign it to a specific agent or multiple agents. The agent will respond to the user, and the user can continue the conversation with the same agent or switch to another agent. We also have a **Global Coordinator Agent** configured in Walpaca Preferences that steps in automatically whenever a chat contains multiple agents and no specific `@agent` is mentioned — deciding which agent(s) should respond, in what exact order, and optionally writing its own coordinator message.

## Technical Details

- **Database Storage (`alpaca.db`)**:
  - The chat session is stored in `alpaca.db` using the existing `chat`, `message`, and `preference` tables (100% compatible with GTK Alpaca).
  - Each agent that replies (including the Global Agent when it writes a message) creates its own separate `Message` entry (`role = "assistant"`, `model = <agent_preference_id>`).
  - Each chat maintains an active `agents` roster (`chat_agents:<chat_id>` merged with historical speakers) so any agent (`ModelPreferences` / Persona) can be added or removed at any moment via the Right Sidebar **Members** widget (`+ Add Agent`) or by typing `@agent`.
- **Global Coordinator Agent (`global_agent_id`)**:
  - Configured instance-wide in **Settings -> Preferences** (`global_agent_id`).
  - When a chat contains multiple agents and the user sends a message without any `@agent` mention, the Global Agent steps in (`POST /api/chats/<chat_id>/route`), inspects the conversation and active chat roster, optionally posts its own `Message` entry, and returns the ordered list of target agents (`["agent1", "agent2", ...]`) to respond sequentially.
- **`@agent` and `@agent1 @agent2` Mentions**:
  - Typing `@` in the chat composer opens an autocomplete menu of Personas / Agents.
  - Typing `@agent` switches/routes the message to that agent and highlights `@agent` in the chat history.
  - Typing `@agent1 @agent2` dispatches sequentially to `agent1` followed by `agent2`, creating a separate `Message` entry for each agent in order.

## Questions & Answers

- **Each agent will have access to the history of the chat?**
  - **Yes.** All messages share the same `chat_id` in `alpaca.db`. Because multi-agent turns execute sequentially, when `@agent1 @agent2` (or Global Agent -> `agent1` -> `agent2`) respond, `agent1`'s completed reply is persisted to `alpaca.db` before `agent2` generates, giving `agent2` full access to both the user prompt and `agent1`'s response.
- **How the agent knows what other agents said?**
  - In `_build_messages_payload()` (`backend/routes/generate.py`), historical messages written by *other* agents (`m.model != active_agent`) are prefixed with `[Agent: <SpeakerName>]:\n<content>`, while `_build_chat_context_prompt()` injects the **Multi-Agent Chat Roster** into the system prompt so each agent knows its own identity, who the Global Agent is, and which messages were spoken by other agents.
- **How the user will know what other agents said?**
  - Every replying agent has its own `Message` bubble in the chat view displaying its distinct Character Name, Avatar (Image or MP4), role badge (`Global`, `Character`, `AI Model`), and Kokoro TTS voice, plus highlighted `@agent` mention pills.
- **How the agents know what the user said?**
  - User messages are stored with `role = "user"` and passed in the conversation history alongside the system prompt context and any `@agent` mentions.
