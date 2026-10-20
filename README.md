# PausePoint 🦥

**Pause without losing the thread. Pick up without the rework.**

PausePoint is a local-first interruption-recovery assistant for developers. Before switching tasks, capture a few rough notes about what you were doing, what changed, what you verified, and where you got stuck. PausePoint shapes those notes into a compact resume capsule, so future-you can restart with the facts and a small next step instead of reconstructing everything from memory.

Built for the Hacktoberfest 2026 DEV Challenge Week 3 theme: **Slow and Steady**.

## The workflow

1. **Capture a pause.** Record the goal, stopping point, changes, verified facts, unknowns and blocker. Don't write a report.
2. **Optionally attach Git facts.** Enter a local repository folder and capture its root, current branch, `git status --short --branch`, `git diff --stat`, and last three commits. The server runs fixed read-only Git commands; it never edits files, commits, pushes, checks out branches, or resets anything.
3. **Generate a resume capsule.** Gemma 3 1B through Ollama produces a brief summary, verified facts, unknowns, next steps, and a paste-ready prompt for the next coding session.
4. **Save and return later.** Capsules are stored in browser `localStorage`; export an individual Markdown note or a JSON backup. No account is required.
5. **Fallback stays honest.** When Ollama or the local API is unavailable, the app marks the result `TEMPLATE MODE` instead of pretending a template came from AI. This also lets a static Vercel preview demonstrate the workflow without a model connection.

## Why this is different

PausePoint is not a generic task manager, inbox summarizer, or AI agent that keeps working while you're away. Its job is to make interruptions less expensive. It keeps the output small and distinguishes supplied/observed facts from uncertain items. The model is asked not to invent test results, file changes, or commands. Git metadata comes from local, read-only commands rather than model guesses.

The AI output is still fallible. Inspect the resume capsule before acting, and verify the working tree when you return. PausePoint does not run commands from generated output.

## Run locally

Requirements: Node.js 18.18+, Git for optional repository context, and [Ollama](https://ollama.com/download) with Gemma 3 1B for local AI generation. No npm dependencies are needed.

```powershell
# Download the model once
ollama pull gemma3:1b

# In this project folder
npm run check
npm test
npm start
```

Open <http://127.0.0.1:4175>.

The status indicator will show **Gemma ready** when the Ollama API responds and the configured model is installed. Generate a capsule and check for the **LOCAL AI** label. If the app says **TEMPLATE MODE**, inspect the notice and use the fallback as a UI-only demonstration.

To change the model or port in PowerShell:

```powershell
$env:OLLAMA_MODEL = "gemma3:1b"
$env:PORT = "4175"
npm start
```

## Tests

```powershell
npm run check
npm test
```

The 16 native tests cover bounded input validation, prompt-injection-as-data handling, separation of verified and uncertain facts, bounded JSON parsing, honest template fallback, server headers, mocked Ollama schema generation, malformed/oversized API bodies, Git snapshot read-only flow, non-repository handling, and path traversal rejection. The mocked API tests do not replace a manual test with the real Gemma weights.

## Privacy and safety

- The server binds to `127.0.0.1`; it is intended for use on the same computer. A static host such as Vercel can show the interface and browser template fallback, but it cannot read your local repository path or connect to Ollama on your PC.
- Notes are sent to `127.0.0.1:11434` for generation when local Ollama is available. If you configure `OLLAMA_URL` to a remote host, prompts go to that host instead.
- Saved capsules use `localStorage` in the current browser profile. They are not encrypted; avoid storing secrets or credentials. Exported backups are plain JSON.
- Git capture executes only fixed, read-only Git commands via `spawn` without a shell. It does not run model-suggested commands.
- Generated next steps and summaries can be wrong. Verify repository state and test claims independently before acting.
- The app shell can be cached by the service worker; generation still needs the local server and Ollama/model.

## Stack

Node.js built-in HTTP · Vanilla JavaScript · CSS · browser `localStorage` · Ollama · Gemma 3 1B · Node's built-in test runner

## Challenge demo checklist

For a short screen recording:

1. Show the goal and a rough stopping-point note.
2. Optionally attach a real Git snapshot from a test repository.
3. Generate a capsule and show `LOCAL AI`.
4. Point out how facts and uncertainties are separate.
5. Save the capsule, copy the return prompt, and show it appears in history.
6. State plainly that no code was changed and that the hosted/template fallback is not live Gemma inference.

A customer trial is not required to describe the project honestly. If you test it with another developer, report their actual feedback rather than inventing a testimonial.

## Optional static Vercel preview

To deploy an interface-only demo, import the repository into Vercel and choose the **Other** preset with no build command and the output directory set to `public`. The hosted preview will use the browser template when `/api/capsule` is unavailable. Local Gemma inference and real local Git snapshots require the Node server running on the same PC, so use a local screen recording to demonstrate those parts. Verify the deployed URL after publishing.

## License

MIT. See `LICENSE`.
