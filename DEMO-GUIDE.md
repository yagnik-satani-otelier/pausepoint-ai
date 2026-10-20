# PausePoint demo recording guide

Target length: 60–100 seconds. Use fictional notes and do not include credentials or private project details.

1. Start with the PausePoint dashboard and show the **Gemma ready** status.
2. Enter a sample project such as `Sample API`, goal `Fix a response parser`, stopping point `The endpoint works but I haven't checked one malformed response`, change `Added input validation`, verified `npm test passes`, uncertainty `Browser test not done`, blocker `Need to reproduce malformed JSON`, next hint `Send malformed JSON and confirm a 400 response`.
3. Optionally enter a throwaway local Git repository folder and click **Read Git status**. Explain that this is read-only.
4. Click **Make my resume capsule**. Wait for the result marked **LOCAL AI**.
5. Show the separate Verified facts / Still uncertain / Next small steps sections.
6. Save the capsule, show it in Resume history, then click **Copy resume prompt** or **Download .md**.
7. Say what is true: the model organized supplied notes; it did not inspect every file or prove the test passed. If it shows **TEMPLATE MODE**, do not present it as an AI demo.

Before recording:

- Ensure `ollama list` includes `gemma3:1b`.
- Run `npm test` and `npm run check`.
- Start `npm start` and open `http://127.0.0.1:4175`.
- Use sample repo data. Do not expose personal paths or confidential diffs in the recording.
- Capture the whole app, the Local AI badge, and a few key output sections.
