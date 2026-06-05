# Contract Clause Tracker

A small web app for labelling legal clauses sentence-by-sentence across a contract library. Built as a take-home for Legartis.

## Running it

```bash
docker compose up --build
```

Then open http://localhost:4200. The API serves at http://localhost:8000/api, with OpenAPI docs at `/api/docs`.

## What's in scope

The case study asked for three things and I built exactly that: upload a contract (txt or markdown), label individual sentences with clause types in a viewer, and a dashboard with search, filter, grouping, and sort. Everything else I considered is in [Future work](#future-work) at the bottom.

## How it's put together

**Backend — FastAPI, SQLite, SQLAlchemy 2.0.** On upload, the contract is split into sentences using `pysbd`, which handles the legal abbreviations (`Inc.`, `Art.`, `e.g.`) that break naive splitters. Each sentence is a row; a label is a `clause_type_id` column on the sentence. Single cardinality per the spec's "a clause is a single sentence" framing. Lines flagged as headings (`is_heading=True`) render in the viewer but aren't labellable. The schema also ships a `clause_suggestions` table and a `GET /api/documents/{id}/suggestions` endpoint that returns `[]` today. Those are the seam for the auto-labelling step we'll add in the pair session.

**Frontend — Angular 17, signals, CDK Overlay.** Standalone components throughout. The dashboard's search / filter / grouping / sort state is bound to the URL query string, so any view is bookmarkable and shareable. The viewer's labelling popover is a CDK ConnectedOverlay anchored to the clicked sentence, implementing the ARIA combobox pattern: typeable search, arrow navigation, Enter applies, Backspace removes when the query is empty, Escape closes. Label changes are optimistic against the local signal and roll back on API failure.

### Why these choices

- **SQLite over Postgres.** No concurrency, ops, or vendor extensions needed at this scale. One fewer service in the compose file, one less thing to defend.
- **Signals over RxJS as the primary state primitive.** Signals where the derivation is synchronous (the dashboard's search → filter → sort → group pipeline is a chain of `computed()`s), RxJS where the source is genuinely async (HTTP, route params). The bridge is `toSignal()` and `toObservable()`. I'd reach for NgRx the moment a third feature needed to react to label changes; with three bounded stores and no cross-cutting actions, NgRx would be boilerplate without payback.
- **Client-side search and filtering.** The dashboard list is small and the filter is a pure function behind a `computed()`. If the list grew past a thousand rows, or we needed full-text search across contract bodies, or we added per-user permissions, the swap is one HTTP call and one signal — no component changes.
- **Editorial serif for the contract body, sans for the chrome.** A reviewer is reading a contract, not an app. Source Serif 4 inherits the editorial tradition that long-form legal text comes in. Inter handles UI text; JetBrains Mono is reserved for IDs and tabular numbers.
- **Sentence pre-split on the server.** The frontend gets a clean `Sentence[]` and renders each as a real `<button>` with proper ARIA. That keeps the labelling UI accessible by construction and avoids fragile character-offset math in the browser.
- **URL-bound dashboard state.** The setter writes; the URL is a serialised snapshot the browser can bookmark, share, or back-button into. I deliberately don't write the URL back into the store on every change — the user action is the writer.
- **HTTP layer.** Two function-style interceptors. `httpRetryInterceptor` retries idempotent GETs on transient failures (network errors and 502/503/504) up to twice, with exponential backoff. POSTs, PUTs, and DELETEs are never retried — they're not idempotent. `httpErrorInterceptor` normalises every failure into a typed `ApiError` shape so downstream code never depends on `HttpErrorResponse`. Adding an auth interceptor or a request-id tracer later is one entry in the `withInterceptors` array.
- **Race protection.** Two paths matter: rapid `load()` calls (the user back-and-forwarding between contracts) cancel the prior in-flight request via `takeUntil(cancelLoad$)`. Rapid `setLabel` / `clearLabel` calls on the same sentence (the picker reopened before the previous PUT resolves) cancel the prior request *and* preserve the **original** pre-optimistic label, so a late failure rolls back to the true starting state — not to an unverified optimistic intermediate.
- **Type safety posture.** `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, and Angular's `strictTemplates` / `strictInjectionParameters` / `strictInputAccessModifiers`. Stores expose writable signals as `.asReadonly()` so external code can't mutate state behind the seam. Zero `any` and zero `$any(...)` template escape hatches — `$event` lands in a typed handler and is cast to `HTMLInputElement` once, in TypeScript, not in the template.

## Accessibility

WCAG 2.2 AA target. The picker is an ARIA combobox with `aria-controls`, `aria-expanded`, and `aria-activedescendant` wiring; focus stays on the search input while arrow keys move the highlight, then returns to the activating sentence on close. Sentences are real buttons, tabbable in document order, with `aria-label` describing the current label state. Label set/remove announce through a polite live region. Colour is paired with text everywhere — no colour-only signals. Every page has a skip-to-main-content link.

**Keyboard walk-through.** Tab through Upload → search → grouping toggle → sort → each row. Enter on a row opens the viewer. Tab through sentences. Enter on a sentence opens the picker; type to filter, ↑/↓ to navigate, Enter to apply, Backspace (with empty query) to remove the current label, Escape to close. Focus returns to the sentence.

## Testing

- **Backend** — pytest covers upload (txt accepted, oversize rejected, bad extension rejected), label set/clear, and the list endpoint's embedded counts.
- **Frontend** — Karma + Jasmine, 52 specs across four layers:
  - *Pure functions* — `searchAndFilter`, `sortDocuments`, `groupDocuments`.
  - *Stores* — `DocumentsStore` (load, search → filter → sort → group pipeline composition, upsert) and `DocumentDetailStore` (404 vs error, optimistic set/clear with rollback on API failure, no-op when no document is loaded).
  - *HTTP services* — `DocumentsApi`, `LabelsApi`, `ClauseTypesApi` against `HttpTestingController` to lock the URL, method, and request body of every call.
  - *Component DOM* — `ClausePicker` (combobox ARIA wiring, `aria-activedescendant` tracking, listbox structure), `ClauseChip`, and `ProgressRing`.
- **E2E** — deferred. The natural happy path (upload → label → see the label on the dashboard) is a Playwright stretch I'd add next if I had another hour.

```bash
cd backend && pytest
cd frontend && npm test -- --watch=false
```

## Future work

The case study capped this at 3–4 hours. The items below are deliberate deferrals, each with the trigger that would move them onto a real backlog.

- **Automatic clause labelling.** The pair-session extension. Schema (`clause_suggestions`) and endpoint (`GET /api/documents/{id}/suggestions`) are stubbed from day one, so the labeller is purely additive — no schema migration, no contract changes.
- **Many-to-many sentence ↔ clause.** The case study assumes single cardinality. The migration is one Alembic revision (junction table, backfill, drop column) and a multi-select picker.
- **Server-side search and pagination.** Triggers: dashboard past ~1,000 documents, full-text search across bodies, or per-user permissions. The current `searchAndFilter` is a pure function behind a signal; swapping it for an HTTP call doesn't touch the components.
- **Virtualised sentence rendering.** For very long contracts. CDK virtual scroll is the natural fit.
- **Bulk operations.** "Apply to similar sentences", "jump to next unlabelled" hotkey, range-select.
- **Dark mode.** The design tokens are CSS variables; dark mode is a `prefers-color-scheme` override, not a rewrite.
- **Mobile labelling.** The viewer would use a bottom-sheet picker on small screens.
- **Auth and permissions.** Single-tenant for now. The natural extension is row-level filtering at the DB layer with the user injected via FastAPI dependency.
- **Conflict handling on labels.** Currently last-write-wins. An ETag-on-PUT pattern would matter as soon as multiple reviewers worked the same document concurrently.
