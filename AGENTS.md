# Project Agent Instructions

## Hard Tool Ban

- Never call `functions.zz`.
- Treat `functions.zz` as a disabled empty placeholder tool.
- Do not use it for probing, validation, progress updates, retries, or any other workflow step.
- If `functions.zz` is accidentally triggered by the runtime/tool UI, do not mention it to the user unless the user explicitly asks about it.

## Tool Use Discipline

Before any tool call, confirm the call has a concrete purpose:

1. Read a specific file or command output.
2. Edit a specific file.
3. Start, stop, or inspect a specific process.
4. Verify a concrete behavior.

If the purpose is not concrete, do not call a tool.

## Preferred Tools

- Use `exec_command` for explicit shell commands.
- Use `apply_patch` for file edits.
- Use `write_stdin` only for an existing running session.
- Use browser automation only when visual or interaction verification is necessary.

## Local Preview

- When a user asks for a local preview link, prefer `npm run preview` instead of `npm run dev`.
- The preview script intentionally stops stale Next.js processes on ports 3000/3001, clears `.next`, and starts Next.js on `127.0.0.1:3000` to avoid recurring stale chunk, missing module, and hot-reload cache issues.
- Use `npm run dev` only when you explicitly need the raw framework command for debugging.
- If a Next.js build or preview fails with missing `.next/server` chunks, stale static chunk 404s, or webpack pack cache errors, stop the running dev server and restart with `npm run preview`.

## Release Version Hygiene

- When preparing a version release, update all user-visible version labels that appear in the shipped UI, especially the `/chat` header badge and report/share filenames.
- Keep `package.json`, `package-lock.json`, `CHANGELOG.md`, and visible in-app version text aligned with the intended release number unless the user explicitly asks to keep them separate.
- Before committing a release, search for stale version strings from the previous release and either update them or confirm they are historical changelog content.

## Communication

- Do not report meaningless internal tool mistakes.
- Report user-relevant outcomes: changed files, verification results, remaining blockers.
- Keep progress updates short and tied to the current task.

## Project Logs

- After meaningful project updates, add a short dated entry to `ASSISTANT_LOG.md` summarizing what changed, why it changed, and any verification or blockers.
- After a version bump, release preparation, or version commit, update `CHANGELOG.md` with the version number, codename if available, release date, and the main user-facing changes.
- Do not add noisy log entries for abandoned experiments, temporary files, failed drafts, or changes that are immediately reverted unless the failure itself is important project context.
- Keep `ASSISTANT_LOG.md` as collaboration history and `CHANGELOG.md` as release history; avoid duplicating the same level of detail in both.
