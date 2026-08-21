# Navigable Published League

## Purpose and user outcome

Make the existing published league experience discoverable from the root page and useful without
authentication. A visitor should be able to move from `/` to the configured league home, schedule,
team directory, and team detail pages through clear contextual navigation, then filter the published
schedule or find a published team on desktop or mobile.

This is a bounded Milestones 0–1 public-read experience. It uses only existing immutable publication
snapshots and synthetic fixtures. It does not introduce schedule authoring, official field-status
decisions, news, standings, player data, registration, waivers, notifications, or external effects.

## Scope

### Included

- Rework `/` as the PUB-21 league gateway with a primary path to one explicitly configured featured
  public league and a safe generic fallback when no league is configured or published.
- Add contextual public-league navigation for league home, current-season schedule, current-season
  teams, and staff sign-in.
- Bring the existing PUB-01 league home closer to its specification using only the published current
  season and basic upcoming-game data already present in public snapshots.
- Add PUB-03 client-side Date, Team, Field, and Status filters, league-timezone date grouping,
  visible result count, reset behavior, filtered-empty state, and desktop-list/mobile-card reflow.
- Add PUB-11 team-name search, result count, reset behavior, filtered-empty state, and responsive team
  cards.
- Improve PUB-12 with the selected team's published schedule items and clear unavailable-section
  messaging without implying that roster, record, affiliation, or statistics data exists.
- Preserve public DTO allowlisting, unpublished-resource denial, safe direction links, strict CSP,
  semantic Modern Field tokens, keyboard access, and 44px minimum interaction targets.
- Add focused component, browser-flow, accessibility, responsive, and retained screenshot evidence;
  update the UI artifact register honestly after implementation.

### Excluded

- Public tenant enumeration, tenant search, or deriving a featured tenant from the first database row.
- New public fields or API contracts unless a separately reviewed need is discovered. In particular,
  division, church affiliation, team record, coach, roster, statistics, news, standings, canonical
  field status, score, and result details are not available in the current public DTOs.
- Invented canonical weather/field status or placeholder facts that could be mistaken for an
  authorized league decision.
- Schedule creation, editing, solver work, publication revision behavior, PDF/ICS/spreadsheet export,
  or notification previews from Milestone 3.
- Authenticated administration changes, new mutations, database migrations, outbox relay work,
  mobile-native screen changes, real source-document import, waiver/legal content, external sends,
  payment behavior, production deployment, or public-internet exposure.
- Claiming full PUB-01, PUB-03, PUB-11, or PUB-12 style compliance where unavailable data or retained
  assistive-technology evidence still leaves a documented gap.

## Relevant requirements

- **FND-002** — Every tenant-owned query is organization-scoped and cross-tenant denial remains
  proven.
- **FND-007** — Public reads continue to use the applicable immutable season/publication version;
  this slice does not complete all versioned configuration obligations.
- **STS-005** — Public consumers remain read-only and receive only tenant-approved fields.
- **STS-007 SHOULD** — Public schedule and team pages become easier to discover and share; broader
  results, standings, leaderboards, archive, and press-release coverage remains later work.
- **OPS-003** — Error handling and telemetry must not reveal tokens, credentials, private contact
  data, or publication payloads.
- **OPS-006** — Changed public web experiences target WCAG 2.2 AA, non-color status, responsive
  reflow, and usable interaction targets.
- **OPS-008** — All development and evidence use the synthetic demo tenant.
- **OPS-013** — This work does not authorize production deployment or any external effect.

## Current-state findings

- The root page previously had no path to the existing public league routes, which matched the user's
  report that the landing page felt like a dead end. It now resolves one validated, explicitly
  configured featured league and otherwise renders a non-enumerating generic fallback.
- Published league home, schedule, team-directory, and team-detail routes remain canonical at
  `/leagues/{organizationSlug}/{leagueSlug}` and its season descendants. The synthetic fixture now
  supports the complete root-to-team browser journey without authentication.
- `PublicLeagueHomeDto` exposes only public organization/league identity and the current published
  season. `PublicTeamDto` exposes only `teamSeasonId`, `slug`, and `publicName`.
  `PublicGameDto` exposes only identity, start time, basic status, public teams, and public field name
  and directions.
- The public schedule now has combined Date, Team, Field, and Status filters, league-timezone date
  grouping, visible live result counts, reset and filtered-empty states, aligned desktop rows, and
  single-DOM mobile cards. Unsafe direction schemes remain visible text rather than links.
- The team directory now searches only approved `publicName` values and provides responsive linked
  cards, count/reset behavior, and a filtered-empty state. Team detail shows only games involving the
  selected published team and degrades schedule failure within that section.
- The public shell now supplies league-aware Home, Schedule, and Teams navigation, visible non-color
  current-page treatment, and a mobile disclosure that closes after navigation.
- PUB-21 specifies the root gateway. The gateway, public navigation, schedule filters/results, team
  search, and affected pages have implementation records and retained synthetic screenshot evidence;
  they remain `Needs changes` rather than `Pass` because real assistive-technology and physical/manual
  review are unavailable.
- The database outbox relay remains incomplete, but this slice performs no authoritative mutation
  and does not depend on delivery processing.
- Five authorized source files remain absent. No source-derived or legal content is needed or allowed
  in this slice.
- Refreshed dependency and container security lanes still fail on known findings. They remain release
  blockers and do not authorize weakening controls, exposing the local application publicly, or
  describing this slice as production-ready.

## Proposed design

### Root league gateway

Treat `/` as a public platform-to-league gateway, not as a tenant directory. Resolve a featured league
only from two validated, server-side deployment settings: organization slug and league slug. When
both settings exist, construct the existing public route and present one clear primary action. Do not
query for or reveal other tenants. When either setting is absent, retain a useful generic explanation,
staff sign-in as a secondary action, and guidance to use a league-provided public link.

If the configured route is withdrawn or unavailable, show a neutral unavailable state rather than
falling back to a different tenant. No credential, internal organization identifier, draft value, or
private field may enter page markup or a client bundle.

### Contextual navigation

Within a resolved league context, provide semantic navigation links to league home and, when a
published current season exists, its schedule and team directory. Staff sign-in remains visually
secondary. The active destination must be identifiable without color alone. Desktop navigation stays
compact and sticky through the existing public shell; mobile navigation uses the existing disclosure
pattern with logical focus order and 44px targets.

### Published league home

Reuse a shared server-rendered league-home composition for the slugged league route. Fetch the
current published schedule only when a current published season exists, sort by `startsAt`, and show
up to four upcoming/basic matchup cards. Do not infer or display an official field-status banner,
news, standings, scores, or records from missing data. The page remains `Partial / Needs changes`
against PUB-01 until those separately governed public snapshots exist.

### Schedule filtering and grouping

Keep the server-fetched `PublicGameDto` collection as the complete data boundary and perform
non-authoritative filtering in a client component. Offer Date, Team, Field, and Status controls with
persistent labels and an explicit reset action. Division is intentionally omitted because the current
public contract contains no division field. Derive date keys and labels in the published season's IANA
timezone, not in the browser timezone, and test dates near a UTC/local-date and daylight-saving
boundary.

Render one semantic collection grouped by local date. Use responsive CSS to present distinct desktop
columns and stacked mobile matchup cards without duplicating accessible content. Announce the result
count politely after a filter change and provide a useful filtered-empty state with reset action.

### Team search and detail

Filter only by normalized published team name. Do not offer nonfunctional affiliation/division
controls. Render large linked team cards and a result count. On team detail, combine the published team
collection with the existing published schedule, match by `teamSeasonId`, and show that team's games.
Do not calculate a record because the current game DTO has no score/result data, and do not render
roster/stat tabs because those fields are not public.

### Failure handling and observability

Preserve 404 behavior for absent/withdrawn league, season, and team routes. Network or upstream errors
use the existing service-unavailable component and request reference. Client filtering is local and
must not produce logs containing public payload contents. No changed interaction has an authoritative
side effect or requires audit/outbox behavior.

## Milestones

- [x] Define PUB-21 and register the root gateway, contextual navigation, schedule filter form, and
      team search form before implementation.
- [x] Add validated default-public-league settings and implement the PUB-21 gateway without tenant
      enumeration or redirecting to an arbitrary tenant.
- [x] Implement contextual league navigation and the bounded PUB-01 upcoming-game presentation.
- [x] Implement PUB-03 filters, timezone date grouping, result/empty states, and responsive result
      cards with focused unit coverage.
- [x] Implement PUB-11 team-name search and PUB-12 team-specific published games with focused unit
      coverage.
- [x] Extend browser E2E and axe coverage for the unauthenticated gateway-to-league flow and retain
      synthetic desktop/tablet/mobile screenshots.
- [ ] Complete real screen-reader, desktop Ctrl-Plus, and physical-device/manual review; retain every
      affected artifact as `Needs changes` until that evidence exists.
- [x] Run the applicable verification matrix, review the diff for public-data leakage and scope creep,
      and update the ExecPlan and handoff documents.

## Verification and acceptance

### Automated behavior

- A visitor can follow visible links from `/` to the configured published league home, schedule, team
  directory, and a team detail without signing in or entering a deep URL.
- With featured-league settings absent, `/` remains usable and does not list, guess, or redirect to a
  tenant. With an invalid/withdrawn configured league, no alternative tenant data appears.
- Draft and withdrawn publication fixtures remain unavailable, and cross-tenant denial tests remain
  green.
- Date, Team, Field, and Status filters can be combined; result count and filtered-empty state update;
  reset restores the complete published set.
- Date headings use the league timezone and remain correct when UTC and local calendar dates differ
  and across a daylight-saving transition.
- A team detail includes only games whose home or away `teamSeasonId` equals the selected published
  team.
- Schedule and team controls have programmatic labels; the active navigation destination and all game
  statuses include visible non-color text.
- At 393px the schedule uses cards without horizontal viewport overflow; at tablet and desktop sizes
  it exposes scannable aligned fields. Interactive targets remain at least 44px.
- Existing CSP nonce/hydration, public allowlist, receiver-safe fetch, safe-directions, not-found,
  service-error, and private-draft regressions remain green.

Run and record:

```bash
pnpm exec prettier --check \
  docs/LEAGUE_APP_UI_STYLE_GUIDE.md \
  docs/UI_ARTIFACT_REGISTER.md \
  execplans/2026-08-19-navigable-published-league.md
pnpm format:check
TURBO_CONCURRENCY=2 pnpm lint
TURBO_CONCURRENCY=2 pnpm typecheck
pnpm contracts:check
TURBO_CONCURRENCY=2 pnpm test:unit
TURBO_CONCURRENCY=2 pnpm build
pnpm import:check
pnpm stack:smoke
pnpm test:e2e
pnpm test:a11y
git diff --check
```

### Recorded results — 2026-08-19

- `pnpm format:check`, `TURBO_CONCURRENCY=2 pnpm lint`,
  `TURBO_CONCURRENCY=2 pnpm typecheck`, `pnpm contracts:check`,
  `TURBO_CONCURRENCY=2 pnpm test:unit`, `TURBO_CONCURRENCY=2 pnpm build`, and
  `pnpm import:check` passed. The web unit suite passed 40/40.
- The rebuilt nine-service Compose stack is healthy. `pnpm stack:smoke` passed 5/5,
  `pnpm test:e2e` passed 7/7, and `pnpm test:a11y` passed 4/4 through the gateway.
- A separate private-LAN Playwright journey passed 5/5 against the private LAN test origin on port
  `8088`, covering root, league home, schedule, team directory, and team detail. This is synthetic
  local testing, not a production deployment or authorization for public-internet exposure.
- The root route was verified as runtime dynamic, and `/icon` returned `200 image/png`.
- Automated Chromium acceptance passed for keyboard/focus navigation, mobile-menu closure, 200% CDP
  zoom/reflow, reduced motion, minimum 44-by-44-pixel targets, logical headings, polite atomic live
  regions, and absence of console/page errors. Real screen-reader use, desktop browser Ctrl-Plus, and
  physical-device/manual review remain unavailable.
- Retained screenshot evidence is linked from `docs/UI_ARTIFACT_REGISTER.md`. The live one-game
  fixture cannot produce an authentic schedule filtered-empty screenshot because every offered filter
  value matches that game; focused component coverage verifies the filtered-empty state instead.
- `pnpm security:dependencies` was refreshed and failed on two high-severity transitive `image-size`
  findings plus one moderate finding; the Python dependency audit is clean.
  `pnpm security:containers` was refreshed and failed on fixable high/critical findings across Compose
  images. The stale ignored JSON counts are not used as current evidence.
- `pnpm verify` is not reported as passing. Release remains blocked by those security findings, five
  absent authorized sources, the incomplete database outbox relay, and the broader Milestones 0–1
  production gates.

If mobile code is unexpectedly changed, stop and amend this plan/register before proceeding, then add
`pnpm test:mobile` and Android/iOS export to the matrix. If an API or database change becomes necessary,
stop and create or expand the appropriate substantial-change ExecPlan before implementation.

### Visual and manual acceptance

- Retain synthetic-data screenshots of `/`, league home, schedule default/filtered/empty, team
  directory default/filtered/empty, and team detail at 1440px, 1024px, and 393px.
- Exercise the complete root-to-team flow with keyboard only, including opening/closing mobile
  navigation, filter changes, reset, and focus-visible treatment.
- Check 200% browser zoom, reduced-motion mode, logical heading order, link purpose, screen-reader
  labels/announcements, long team/field names, invalid directions text, and no horizontal viewport
  overflow.
- Record exact review evidence in `docs/UI_ARTIFACT_REGISTER.md`. Automated axe results do not replace
  manual screen-reader review; artifacts with missing evidence remain `Needs changes`.

### Security gates

Run `pnpm security:dependencies` and, when the rebuilt stack is running for the planned security lane,
`pnpm security:containers`. Record exact results rather than treating the known nonzero findings as a
pass. This slice can be accepted as a local synthetic UI increment while Milestones 0–1 and any release
remain blocked by known high findings, missing authorized sources, outbox completion, and other
documented gates. Do not report `pnpm verify` as passing unless every lane actually passes.

## Migration, rollback, and data compatibility

No database migration, publication payload rewrite, or destructive operation is planned. Featured
league configuration is additive and optional; removing the settings restores the generic root
fallback. Public UI changes can be reverted independently while the existing deep public routes and
publication snapshots remain compatible.

Do not delete or recreate local volumes for this slice. If implementation unexpectedly requires a
public-contract or schema change, stop, document compatibility and rollback in a new or expanded
ExecPlan, and run the contract/migration/restore acceptance appropriate to that change.

## Security and privacy review

- The gateway is configuration-driven and never enumerates tenants or selects the first database row.
- Every public response continues to originate from immutable allowlisted publication snapshots.
- No internal Team, Person, membership, contact, minor, waiver, audit, or credential field is rendered
  or added to client state.
- Missing fields remain absent; neutral unavailable copy must not be confused with an authorized field
  status, official score, record, affiliation, roster, or statistic.
- Filter/search values are local display state, are length-bounded if reflected in a URL, and never
  become raw HTML or database query fragments.
- Direction links retain the existing HTTP/HTTPS allowlist and safe text fallback.
- Evidence uses only synthetic demo records and contains no generated password or local credential.
- This work does not alter the outbox, send messages, use real source documents, change legal text,
  deploy publicly, or authorize production/LAN firewall changes.

## Decisions made

- Improve the discoverability and completeness of existing public-read pages before creating broader
  administration or Milestone 2 mutation surfaces.
- ADR-022: use an explicitly configured featured league at `/`; do not create a public
  tenant-directory API.
- Keep the slugged league URL canonical and use the root gateway as a visible entry path rather than
  silently choosing a tenant.
- Limit filters and team details to current public DTO fields. Honest partial conformance is preferable
  to invented data or premature contract expansion.
- Keep this plan separate from the database outbox relay and container hardening work so each change
  has an independently reviewable risk, rollback, and acceptance boundary.

## Discoveries and risks

- PUB-01 expects canonical field status, news, and standings, while PUB-11/PUB-12 expect affiliation,
  record, roster, and statistics. None are present in the current allowlisted public snapshots, so
  those artifacts cannot be marked fully implemented or style-compliant in this slice.
- PUB-03 names Division as a filter, but the current public game payload has no division. Adding a
  disabled or decorative control would be misleading; contract expansion remains future work.
- The published synthetic schedule contains one fixed-date game. Focused unit fixtures use multiple
  dates, teams, fields, and statuses to prove filtering and grouping without expanding authoritative
  seed scope; the live fixture cannot authentically demonstrate schedule filtered-empty screenshots.
- Client-side filtering is suitable for the small Milestone 1 published snapshot. Pagination or
  server-side query design must be revisited before using this pattern for materially larger seasons.
- Retained 1440px, 1024px, and 393px screenshots now exist. Real screen-reader, desktop Ctrl-Plus, and
  physical-device/manual evidence do not.
- The outbox relay, source-document traceability, upstream dependency findings, container findings,
  native-device review, and clean-clone/full-verify evidence remain independent Milestones 0–1 gates.

## Progress log

- 2026-08-19 — Audited `IMPLEMENT.md`, the active bootstrap ExecPlan, project status, Milestones 0–1
  requirements/roadmap, the public contracts/services/pages, and the UI style register. Selected the
  read-only navigable published-league slice because it directly removes the observed root-page dead
  end without depending on legal sources or unfinished delivery effects.
- 2026-08-19 — Added PUB-21 and registered the root gateway, contextual league navigation, schedule
  filter form, and team search form before any implementation. No code, runtime service, container,
  database, Git index, remote repository, production system, or real data was changed.
- 2026-08-19 — Implemented the validated runtime-configured gateway, contextual public navigation,
  bounded league-home cards, schedule filtering/grouping/reflow, team-name search, and team-specific
  schedule view without expanding the allowlisted public contracts.
- 2026-08-19 — Closed the initial review findings: mobile navigation closes on route changes; team
  detail resolves the published team before independently handling schedule availability; embedded
  schedule headings preserve `h1` → `h2` → `h3`; the root is runtime dynamic; and the site icon serves
  as `image/png`.
- 2026-08-19 — Passed format, lint, typecheck, contracts, full unit, build, import, 5/5 smoke, 7/7 E2E,
  4/4 axe, and 5/5 private-LAN public-journey lanes. Automated keyboard/focus, mobile-menu, zoom/reflow,
  reduced-motion, target-size, heading/live-region, and browser-error checks also passed.
- 2026-08-19 — Retained 12 synthetic responsive PNGs and updated the artifact reviews as `Needs
  changes`. Real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain unavailable.
  Refreshed dependency and container security lanes still fail; five authorized sources and the outbox
  relay remain outstanding, so neither this slice nor `pnpm verify` is described as production-ready.
- 2026-08-19 — Closed the final privacy and determinism review: deployment-selected slugs no longer
  cross the server/client boundary, environment initialization rejects a half-configured featured
  league pair, parallel public journeys use a stable seeded team, and the publication E2E withdraws
  its synthetic team in an audit-preserving `finally` path. With seven older synthetic E2E
  publications withdrawn through the same API, the public directory and refreshed default-team
  screenshots contain only the two seeded demo teams.
