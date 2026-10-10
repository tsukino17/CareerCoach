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

## Collaboration Autonomy

- Once the user has stated a concrete goal, own the work end to end: choose the implementation details, execute the necessary steps, verify the result, and hand back the completed outcome in the same turn whenever feasible.
- Do not repeatedly ask the user to approve ordinary intermediate actions that are clearly part of the stated goal. Resolve routine technical choices independently and prefer the best complete result over a sequence of permission requests.
- Pause for user input only when the decision would materially change the product direction, requires a password/secret or first-time external authorization, performs an irreversible or destructive operation, sends an external message with unclear scope, or cannot proceed safely without missing user context.
- When user authorization has already been given for a clearly scoped recurring or external operation, do not ask for it again on every run. Preserve the authorization boundary and report the result afterward.
- If a necessary authorization or clarification is required, make the smallest focused request, then continue all independent work without waiting.
- After reaching the goal, report the outcome, verification, and only the remaining blockers or decisions that genuinely require the user.

## External Service Rate Limits

- User approvals do not mean external requests should run at unlimited concurrency. Treat each external service as a bounded queue and schedule work according to that service's rate limits.
- Keep email operations, OAuth, destructive mailbox actions, Supabase writes, and deployment operations serial. Do not issue duplicate sends, deletes, or authorization retries while an earlier request is pending.
- For read-only checks, merge overlapping queries and use a small bounded concurrency instead of firing many requests at once. Prefer one authoritative response over repeated polling.
- On HTTP 429 or an equivalent rate-limit response, stop issuing requests to that service, honor `Retry-After` when provided, then retry with capped exponential backoff and jitter. Never retry a write blindly when the outcome is unknown; verify its status first or use an idempotency key.
- When a request reaches its retry limit, report the service, operation, and request ID, then continue independent local work. Do not treat the error as a missing user approval or immediately launch another identical retry.
- Keep a short-lived task queue for multi-part goals: finish or verify the current external operation before starting the next dependent operation, while local analysis and file edits may continue independently.
- For the Codex/upstream request path, use one active model request per task unless a genuinely independent read-only check is required. Coalesce successive user edits into the current task, pause new upstream calls after a 429, and resume only after the backoff window. A surfaced retry-limit error is a recovery event: preserve the task state, avoid restarting the whole task, and continue from the last verified checkpoint.
- Retry policy must be bounded: prefer `Retry-After`, otherwise use capped exponential backoff with jitter (for example 2s, 5s, 10s, then stop). Never run parallel retries, never retry a non-idempotent external write when the result is unknown, and never turn a rate-limit response into repeated user approval requests.

## Task Queue And Prioritization

- Treat successive user comments as updates to one active goal unless the user clearly replaces that goal. Maintain a task queue internally and keep moving toward the latest overall outcome.
- Decide priority autonomously: first resolve blockers and correctness risks, then complete the core user-facing result, then verification, then polish and cleanup. Do not ask the user to order ordinary implementation details.
- Decide concurrency autonomously. Run independent, read-only local checks in bounded parallelism when useful; serialize edits to the same file, dependent build steps, external service calls, email operations, authentication, destructive actions, and deployment work.
- When a new request arrives during ongoing work, merge it into the queue if compatible, re-evaluate dependencies and concurrency, and continue. Do not abandon completed work or restart unrelated tasks from scratch.
- Keep the user informed only at meaningful milestones: scope changes, blockers, authorization points, completed verification, and final outcomes. Do not turn every queue decision or intermediate retry into a user question.
- Before handing back the result, check that the latest user request is reflected, dependent tasks are complete, and no running process or external operation remains unresolved.
- If the upstream model request itself is temporarily unavailable, finish safe local work such as reading, planning, editing, and validation in the same queue; only pause when the blocked operation is indispensable and cannot be recovered from the last verified state.

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

### Reality Path Product Principle

- The reality path is an ability-migration map, not a deficit-repair or homework list. Start from the belief that users are intelligent and already possess meaningful abilities and resources; the coach helps them notice, name, translate, and mobilize those assets toward a target role.
- The reality path coach is a translator: first see recurring strengths and resources in the user's past, then translate old-role behaviors into target-role actions, identify where those abilities can transfer, and finally help the user choose one low-friction way to call them into use.
- For each target role, the coaching flow must lock 3–5 core capabilities, verify one at a time with one high-value piece of proven work evidence, summarize experience → reusable capability → target-role action, and then move on. After all 3–5 are checked, summarize confirmed, partial, and unverified evidence before offering the next exploration entry.
- Reality clue verification has an explicit trigger: after a concrete role is selected and the user gives one high-value experience/result for the current capability, the coach must summarize experience → reusable capability → target-role action and pause for one user confirmation. This evidence confirmation is separate from the later confirmation to write a batch update to the left board.
- Tools, frameworks, technologies, and software are not forbidden questions; they are later-stage context. During early direction exploration, prioritize what the user has done, solved, and delivered. After the user confirms a concrete target direction, use real job descriptions to explain common tools as replaceable ways of working; do not treat a mentioned tool as a capability gap unless the role explicitly requires a non-substitutable certification, license, or technical condition.
- Do not make “what the user lacks” the default storyline. Distinguish between missing ability, missing evidence, missing market language, and an unused resource. Only surface a gap when it materially affects the target path, and frame it as the smallest evidence or access step needed to make an existing ability legible and usable.
- Product surfaces, records, scores, prompts, and actions should make users feel “I already have a path I can continue” rather than “I must become someone else first.” Do not overclaim that every ability transfers; make transfer hypotheses explicit and verify them through real work tasks, evidence, and user preference.
- The coach should awaken and guide discovery, not lecture or prescribe. Use concrete reflection, comparisons, and one focused question to help users form their own judgment; do not rush to tell them what they should do. Offer actions only when the user asks for advice or has already seen a specific possibility they want to pursue, and present the smallest choice or experiment rather than a command.
- The task list is a user-owned articulation space, not a coach assignment queue. When a user says “perhaps I should look into X,” treat that as valuable self-generated direction: affirm it, help expand the possible channels, search angles, people, communities, materials, and comparison questions, then record only what the user chooses to keep.

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
- After every user-facing UI change, automatically run `npm run preview`, wait for the target route compilation to finish, and verify both the route response and its referenced Next.js CSS asset before sharing a preview link. Do not hand off a URL while the preview process is still compiling or before CSS has been confirmed.
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
