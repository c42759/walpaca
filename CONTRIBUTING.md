# Contributing to Walpaca

Thank you for your interest in contributing to Walpaca! Please take a moment to review these guidelines before submitting code or opening an issue.

> [!WARNING]
> Purely AI-generated issues and pull requests will be rejected. Repeated offenses will result in a ban from the repository. AI can be a useful tool, but contributors must understand, test, and ensure code readability before submitting.

---

## Contribution Workflow

1. **Check Issues**: Before writing code, check open [issues](https://github.com/c42759/walpaca/issues) to see if the bug or feature is already being addressed.
2. **Discuss First**: Leave a comment on the relevant issue expressing your intent to work on it.
3. **Wait for Approval**: Wait for approval from [@c42759](https://github.com/c42759) before starting work, as development might already be in progress.
4. **Develop on a Branch**: Create a descriptive branch (e.g., `feat/image-recognition` or `fix/tts-streaming`).
5. **Test Thoroughly**: Verify your changes locally before opening a pull request.
6. **Open a PR**: Link the PR to the approved issue, explain what was changed, and include screenshots or recordings for any UI changes.

---

## Local Development & Testing

### Frontend (Next.js / React)
- Navigate to the frontend directory:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
- Run the linter to verify formatting and syntax:
  ```bash
  npm run lint
  ```

### Backend (Python / Flask)
- Ensure your changes maintain compatibility with SQLite `alpaca.db`.
- Check backend syntax and test modified endpoints.

### Full Stack (Docker Compose)
- Always verify your changes run cleanly inside Docker:
  ```bash
  docker compose up --build
  ```

---

## Translations

Walpaca is built as a web interface. If you want to contribute translations or help implement an internationalization (i18n) framework for the web app, please open an issue first to discuss the structure.

---

## Q&A

### Do I need to comment my code?
Only when explaining complex or non-obvious logic. Write self-explanatory code with clean naming whenever possible.

### What if I need help or do not understand existing code?
Reach out in the issue discussion. Questions and clarifications are always welcome.

### What editor or IDE should I use?
Use whatever you are comfortable with (VS Code, Cursor, Neovim, WebStorm, etc.).

### Can I be credited?
Yes! Significant contributors will be credited in the [Thanks](https://github.com/c42759/walpaca#thanks--acknowledgments) section of the README.
