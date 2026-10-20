# Test results

Verified in the project workspace on 2026-10-20.

- `npm run check`: passed (Node syntax checks for server, core logic, and browser JavaScript).
- `npm test`: **17 tests passed, 0 failed**.
- Browser harness note: a full interactive browser walkthrough was blocked by the execution environment, so no browser-level success is claimed here.
- HTTP smoke test: `/` returns HTTP 200 with security headers.
- API smoke test without Ollama: `/api/status` reports that local Ollama is unavailable and template mode is ready; `/api/capsule` returns a clearly labelled template capsule.
- Mocked Ollama integration tests verify the JSON-schema request, parse a capsule from a mocked model response, and cover invalid/oversized requests.
- Git snapshot tests use a temporary Git repository and verify that read-only metadata can be captured. The server runs fixed Git commands without a shell.

Limitations: these tests do not validate real Gemma output quality or replace a manual browser test with Ollama running on the target PC. Capture a local Gemma demonstration before claiming real-model behavior in a public submission.

- Regression test: capsule normalization prioritizes user notes over unrelated Git filenames and commit subjects, filters leaked field names, and suppresses model-invented first commands.
