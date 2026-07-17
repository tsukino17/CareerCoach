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

## Product Quality Principle

- Do not design product behavior from a fallback-first mindset. Fallbacks are only the minimum safety net for abnormal, slow, missing, or degraded states.
- Start every product/UI/content implementation from the best intended user experience: high-quality output, accurate meaning, strong information value, and polished presentation.
- When space, latency, or technical constraints exist, preserve meaning and user value first, then simplify layout or reduce quantity. Do not let defensive truncation, generic filler, or low-information placeholder logic become the normal path.
- For generated reports, share images, summaries, and user-facing writing, prefer complete, high-signal, semantically faithful content. If content must be shortened, rewrite or select better complete ideas rather than exposing broken fragments.
- When a user reports a repeated UX, visual, content, or product-quality problem, do not keep making isolated surface tweaks. Step back, find the shared root cause, align prompt rules, rendering logic, data rules, and interaction triggers as needed, then self-review from product management, UX, visual design, and engineering perspectives before handing back the preview.

## Code Quality Discipline

- Write code in a syntactically complete, type-aware style the first time, instead of relying on later build errors to catch basic mistakes.
- Before applying edits, mentally check object literals, ternaries, JSX tags, imports, hook dependencies, and TypeScript return types for obvious syntax or type-shape issues.
- Keep new code consistent with nearby patterns and prefer small, verifiable edits when changing active UI or API paths.
- After meaningful code changes, run the narrowest useful verification available and fix issues introduced by the current change before moving on.

## Local Preview

- After completing a user-facing feature change, automatically provide the most relevant local preview URL in the final response when a local preview is available or easy to start.
- When a user asks for a local preview link, prefer `npm run preview` instead of `npm run dev`.
- The preview script intentionally stops stale Next.js processes on ports 3000/3001, clears `.next`, and starts Next.js on `127.0.0.1:3000` to avoid recurring stale chunk, missing module, and hot-reload cache issues.
- A local preview is only considered valid when both the target route and its Next.js CSS assets load successfully. Do not treat an HTML `200 OK` alone as enough, because a page can render unstyled when `/_next/static/css/...` assets are stale or missing.
- `npm run preview` performs a style verification pass after startup. If it reports missing or tiny CSS assets, restart via `npm run preview` after clearing stale processes/cache instead of giving the user that link.
- If port 3000 is already occupied by a previously working preview server, do not spend excessive time restarting it. Reuse the existing valid preview URL, usually `http://127.0.0.1:3000/<route>`, unless there is concrete evidence that it is stale or broken.
- When reusing an existing preview URL, first check that the route is styled, either by confirming CSS assets load or by a quick browser visual check when the user has reported styling problems.
- If preview startup hits a port conflict, check the route once against the existing server before killing or restarting processes; only clean up the port when the existing server fails or is clearly not serving the current project.
- Use `npm run dev` only when you explicitly need the raw framework command for debugging.
- If a Next.js build or preview fails with missing `.next/server` chunks, stale static chunk 404s, or webpack pack cache errors, stop the running dev server and restart with `npm run preview`.

## Release Version Hygiene

- Every release version update must be applied as one synchronized change to `package.json`, `package-lock.json`, `CHANGELOG.md`, and every current user-visible version label in the app.
- `README.md` is also a required release surface: update its current version and user-facing feature/deployment notes in the same release change.
- The `/chat` header badge is a required release surface: it must match the package version exactly, including the `v` prefix used by the UI.
- Report/share filenames and any other shipped UI version labels must use the same release version unless the user explicitly asks to keep them separate.
- Before committing or pushing a release, search for stale version strings from the previous release; update active code and UI references, while leaving only historical changelog entries unchanged.
- A release is not ready to push until `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, and the `/chat` badge have been checked together in the same verification pass.

## GitHub To Vercel Release Flow

- Before every GitHub push, run a release security scan over the staged release scope and the full working tree for secrets or private local material.
- Never commit `.env*` files, Supabase service-role keys, Resend/API keys, access tokens, refresh tokens, passwords, private certificates, browser credentials, mailbox credentials, or generated local data.
- Treat any credential-shaped match as a release blocker: remove it from the commit, rotate the credential if it was previously pushed, and only continue after rescanning the exact staged diff.
- Confirm `.gitignore` covers local environment files and review `git diff --cached` plus `git status --short` before pushing.
- After pushing or merging release code on GitHub, do not assume production has updated. Verify the Vercel deployment explicitly.
- Use Vercel CLI from the project root when available; `npx vercel` is acceptable if no global `vercel` binary exists.
- Preferred verification commands:
  - `npx vercel ls` to confirm the latest Production deployment is `Ready`.
  - `npx vercel inspect https://echotalent.fun` to confirm the `echotalent.fun` alias points to the latest Production deployment.
  - `curl -I https://echotalent.fun/chat` to confirm the production route responds.
- After deployment, open `https://echotalent.fun/chat?new=true` and verify the visible `/chat` version badge matches the release version.
- For chat/report releases, run one production smoke test:
  - Send a short non-sensitive chat message and check that the reply streams without visible error.
  - Open or generate `/report` only when the release touched report generation or report UI.
- If production still shows an old version after GitHub push, check whether Vercel production is tracking `main` or a release branch before making more code changes.
- If Vercel CLI reports an invalid token, ask the user to run `npx vercel login`; after authorization, continue with `npx vercel ls` and `npx vercel inspect`.

## Communication

- Do not report meaningless internal tool mistakes.
- Report user-relevant outcomes: changed files, verification results, remaining blockers.
- Keep progress updates short and tied to the current task.

## Project Logs

- After meaningful project updates, add a short dated entry to `ASSISTANT_LOG.md` summarizing what changed, why it changed, and any verification or blockers.
- After a version bump, release preparation, or version commit, update `CHANGELOG.md` with the version number, codename if available, release date, and the main user-facing changes.
- Do not add noisy log entries for abandoned experiments, temporary files, failed drafts, or changes that are immediately reverted unless the failure itself is important project context.
- Keep `ASSISTANT_LOG.md` as collaboration history and `CHANGELOG.md` as release history; avoid duplicating the same level of detail in both.
