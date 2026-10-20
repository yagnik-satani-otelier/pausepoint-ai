# Changelog

## 1.0.2 - 2026-10-20

- Added deterministic post-generation guardrails to keep the user's stated goal and stopping point in control of the capsule.
- Keep verified items limited to user-reported checks and captured branch facts; keep unknowns tied to explicit uncertainty/blocker notes.
- Prevent generated commands and unrelated Git filenames/commit subjects from becoming resume steps.
- Expanded prompt rules and added a regression test for Git-context drift and leaked JSON field names.

## 1.0.1 - 2026-10-20

- Added a browser-only template fallback so the static hosted preview remains interactive without the local Node API.
- Added tests for browser fallback behavior.

## 1.0.0 - 2026-10-20

- Initial PausePoint MVP for the Hacktoberfest Week 3 Slow and Steady theme.
- Added local Gemma/Ollama resume capsule generation with explicit structured output schema and honest template fallback.
- Added optional read-only Git snapshot for repository root, branch, status, diff summary and recent commits.
- Added local browser history, resume prompt copy, Markdown export, JSON backup and clear-history control.
- Added privacy, safety, setup and demo documentation.
- Added native Node tests for core logic, the mocked Ollama bridge, and Git snapshot behavior.
