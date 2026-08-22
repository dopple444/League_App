# UI artifact register

Last updated: 2026-08-22

Visual authority: [`LEAGUE_APP_UI_STYLE_GUIDE.md`](LEAGUE_APP_UI_STYLE_GUIDE.md)

This is the living implementation and review ledger for every user-visible page, native screen, form, reusable interaction pattern, document, message, and exported visual. The style guide defines the intended design; this file records what exists, what specification governs it, and whether the implementation has been checked.

Product, legal, security, privacy, and acceptance requirements remain authoritative over illustrative UI wording or behavior.

## Required workflow

Before creating or materially changing a user-visible artifact:

1. Find the matching stable specification in Section 8 of the style guide.
2. If no specification fits, add a complete specification to the appropriate style-guide family (`PUB`, `TEAM`, `ADM`, `MOB`, `SYS`, `ACC`, `DOC`, or `COM`) before implementing the artifact. Do not reuse an existing ID.
3. Add one row to this register for each page or screen, form, and generated output. A form embedded in a page still receives its own row. Related low-level primitives may share a row only when they are reviewed and released as one design-system set.
4. Set the build and style-review states honestly. Existing code is not compliant merely because it renders or has automated tests.
5. Before setting **Pass**, copy the review-record template into this file, complete every applicable check, and link the evidence from the row.

A child form or component may reference its parent page specification only when that specification explicitly covers its fields, states, layout, and interaction. Otherwise, extend the guide first.

## Status vocabulary

| Field        | Allowed values                                                              |
| ------------ | --------------------------------------------------------------------------- |
| Build        | Planned, In progress, Partial, Implemented, Retired                         |
| Style review | Spec needed, Not reviewed, Needs changes, Blocked, Pass, Exempt with reason |

`Pass` means every applicable checklist item is satisfied against a named guide revision and supported by evidence. `Exempt with reason` requires a documented, approved reason; it is not a shortcut for unfinished work.

## Current page and screen baseline

The guide was introduced after the initial UI was implemented. The shared Modern Field foundation has since been reconciled and reviewed as recorded below; page- and flow-level artifacts remain **Not reviewed**, **Needs changes**, or **Spec needed** until their own reviews are complete.

| Register ID   | Artifact and route                                                                                  | Surface/type        | Source                                                                                                    | Guide mapping                                    | Build       | Style review  | Review record |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- | ------------- | ------------- |
| WEB-PAGE-001  | League gateway and tenant entry `/`                                                                 | Web page            | `apps/web/src/app/page.tsx`                                                                               | PUB-21                                           | Implemented | Needs changes | [WEB-PAGE-001](#web-page-001--league-gateway-and-tenant-entry)               |
| WEB-PAGE-002  | Sign in `/sign-in`                                                                                  | Web page            | `apps/web/src/app/sign-in/page.tsx`                                                                       | SYS-01                                           | Implemented | Needs changes | —             |
| WEB-PAGE-003  | Organization chooser `/admin/organizations`                                                         | Web page            | `apps/web/src/app/admin/organizations/page.tsx`                                                           | No exact match                                   | Implemented | Spec needed   | —             |
| WEB-PAGE-004  | Organization command center `/admin/{organizationId}`                                               | Web page            | `apps/web/src/app/admin/[organizationId]/page.tsx`                                                        | ADM-01                                           | Partial     | Needs changes | —             |
| WEB-PAGE-005  | Season list `/admin/{organizationId}/seasons`                                                       | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/page.tsx`                                                | ADM-03                                           | Partial     | Needs changes | —             |
| WEB-PAGE-006  | New season `/admin/{organizationId}/seasons/new`                                                    | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/new/page.tsx`                                            | ADM-03 (partial; guide specifies a wizard/modal) | Partial     | Needs changes | —             |
| WEB-PAGE-007  | Season editor `/admin/{organizationId}/seasons/{seasonId}`                                          | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/page.tsx`                                     | ADM-03/ADM-04 overlap; exact workspace missing   | Partial     | Spec needed   | —             |
| WEB-PAGE-008  | New administrative team `/admin/{organizationId}/seasons/{seasonId}/teams/new`                      | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/teams/new/page.tsx`                           | No exact match                                   | Implemented | Spec needed   | —             |
| WEB-PAGE-009  | Administrative team editor `/admin/{organizationId}/seasons/{seasonId}/teams/{teamSeasonId}`        | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/teams/[teamSeasonId]/page.tsx`                | No exact match; ADM-15 is roster detail          | Partial     | Spec needed   | —             |
| WEB-PAGE-010  | Audit explorer `/admin/{organizationId}/audit`                                                      | Web page            | `apps/web/src/app/admin/[organizationId]/audit/page.tsx`                                                  | ADM-56                                           | Partial     | Needs changes | —             |
| WEB-PAGE-011  | Public league home `/leagues/{organizationSlug}/{leagueSlug}`                                      | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/page.tsx`                                       | PUB-01                                           | Partial     | Needs changes | [WEB-PAGE-011](#web-page-011--public-league-home)                            |
| WEB-PAGE-012  | Public schedule explorer `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/schedule`  | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/schedule/page.tsx`         | PUB-03                                           | Partial     | Needs changes | [WEB-PAGE-012](#web-page-012--public-schedule-explorer)                      |
| WEB-PAGE-013  | Public team directory `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/teams`        | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/teams/page.tsx`            | PUB-11                                           | Partial     | Needs changes | [WEB-PAGE-013](#web-page-013--public-team-directory)                         |
| WEB-PAGE-014  | Public team detail `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/teams/{teamSlug}` | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/teams/[teamSlug]/page.tsx` | PUB-12                                           | Partial     | Needs changes | [WEB-PAGE-014](#web-page-014--public-team-detail)                            |
| WEB-PAGE-015  | Venues and fields `/admin/{organizationId}/venues`                                                 | Web page            | `apps/web/src/app/admin/[organizationId]/venues/page.tsx`                                                  | ADM-26                                           | Implemented | Needs changes | [WEB-PAGE-015](#web-page-015--venues-and-fields)                              |
| WEB-PAGE-016  | League basics `/admin/{organizationId}/leagues`                                                   | Web page            | `apps/web/src/app/admin/[organizationId]/leagues/page.tsx`                                                 | ADM-63                                           | Implemented | Needs changes | [WEB-PAGE-016](#web-page-016--league-basics)                                  |
| WEB-PAGE-017  | Privileged MFA enrollment `/auth/enroll-mfa`                                                     | Web page            | `apps/web/src/app/auth/enroll-mfa/page.tsx`                                                               | SYS-06                                           | Implemented | Needs changes | —                                                                            |
| WEB-PAGE-018  | MFA sign-in challenge `/auth/two-factor`                                                         | Web page            | `apps/web/src/app/auth/two-factor/page.tsx`                                                               | SYS-06                                           | Implemented | Needs changes | —                                                                            |
| WEB-STATE-001 | Global loading state                                                                                | Web system state    | `apps/web/src/app/loading.tsx`                                                                            | SYS-04                                           | Implemented | Needs changes | —             |
| WEB-STATE-002 | Global error and service-unavailable states                                                         | Web system state    | `apps/web/src/app/error.tsx`; `apps/web/src/components/site-shell.tsx`                                    | SYS-04                                           | Implemented | Needs changes | —             |
| WEB-STATE-003 | Not-found state                                                                                     | Web system state    | `apps/web/src/app/not-found.tsx`                                                                          | SYS-04                                           | Implemented | Needs changes | —             |
| MOB-PAGE-001  | Invitation/sign-in                                                                                  | Native screen/form  | `apps/mobile/app/(auth)/sign-in.tsx`                                                                      | MOB-01; SYS-01 overlap                           | Partial     | Needs changes | —             |
| MOB-PAGE-002  | Personalized home                                                                                   | Native screen       | `apps/mobile/app/(app)/home.tsx`                                                                          | MOB-02                                           | Partial     | Needs changes | —             |
| MOB-PAGE-003  | Organization chooser                                                                                | Native screen       | `apps/mobile/app/(app)/organizations.tsx`                                                                 | MOB-01 context switching                         | Partial     | Needs changes | —             |
| MOB-PAGE-004  | Account                                                                                             | Native screen       | `apps/mobile/app/(app)/account.tsx`                                                                       | MOB-28; ACC-01 through ACC-04 overlap            | Partial     | Needs changes | —             |
| MOB-STATE-001 | Root loading and error boundary                                                                     | Native system state | `apps/mobile/app/_layout.tsx`; `apps/mobile/app/index.tsx`                                                | SYS-04                                           | In progress | Needs changes | —             |
| MOB-NAV-001   | Authenticated bottom-tab shell                                                                      | Native navigation   | `apps/mobile/app/(app)/_layout.tsx`                                                                       | Sections 5, 6, and 10                            | In progress | Needs changes | —             |

## Current form baseline

| Register ID  | Form                                 | Surface     | Source                                                 | Guide mapping                             | Build       | Style review  | Review record |
| ------------ | ------------------------------------ | ----------- | ------------------------------------------------------ | ----------------------------------------- | ----------- | ------------- | ------------- |
| WEB-FORM-001 | Sign in                              | Web form    | `apps/web/src/components/auth/sign-in-form.tsx`        | SYS-01                                    | Implemented | Needs changes | —             |
| WEB-FORM-002 | Create season                        | Web form    | `apps/web/src/components/admin/season-create-form.tsx` | ADM-03                                    | Implemented | Needs changes | —             |
| WEB-FORM-003 | Edit and publish season              | Web form    | `apps/web/src/components/admin/season-editor.tsx`      | ADM-03/ADM-04 overlap; exact form missing | Partial     | Spec needed   | —             |
| WEB-FORM-004 | Create administrative team           | Web form    | `apps/web/src/components/admin/team-create-form.tsx`   | No exact match                            | Implemented | Spec needed   | —             |
| WEB-FORM-005 | Edit and publish administrative team | Web form    | `apps/web/src/components/admin/team-editor.tsx`        | No exact match                            | Partial     | Spec needed   | —             |
| WEB-FORM-006 | Public schedule filters              | Web form    | `apps/web/src/components/public-schedule.tsx`          | PUB-03                                    | Implemented | Needs changes | [WEB-FORM-006](#web-form-006--public-schedule-filters) |
| WEB-FORM-007 | Public team-name search              | Web form    | `apps/web/src/components/public-team-directory.tsx`    | PUB-11                                    | Implemented | Needs changes | [WEB-FORM-007](#web-form-007--public-team-name-search) |
| WEB-FORM-008 | Create or edit venue                 | Web form    | `apps/web/src/components/admin/venue-field-manager.tsx` | ADM-62                                    | Implemented | Needs changes | [WEB-FORM-008](#web-form-008--create-or-edit-venue) |
| WEB-FORM-009 | Create or edit field                 | Web form    | `apps/web/src/components/admin/venue-field-manager.tsx` | ADM-62                                    | Implemented | Needs changes | [WEB-FORM-009](#web-form-009--create-or-edit-field) |
| WEB-FORM-010 | Create or edit league                | Web form    | `apps/web/src/components/admin/league-manager.tsx`      | ADM-63                                    | Implemented | Needs changes | [WEB-FORM-010](#web-form-010--create-or-edit-league)   |
| WEB-FORM-011 | Privileged MFA enrollment            | Web form    | `apps/web/src/components/auth/mfa-enrollment-form.tsx`  | SYS-06                                    | Implemented | Needs changes | —                                                      |
| WEB-FORM-012 | MFA sign-in challenge                | Web form    | `apps/web/src/components/auth/mfa-challenge-form.tsx`   | SYS-06                                    | Implemented | Needs changes | —                                                      |
| MOB-FORM-001 | Sign in                              | Native form | `apps/mobile/app/(auth)/sign-in.tsx`                   | MOB-01                                    | Implemented | Needs changes | —             |

## Current shared-foundation baseline

| Register ID    | Artifact                                                             | Surface/type                 | Source                                                                                                  | Guide mapping                   | Build       | Style review  | Review record                                                                 |
| -------------- | -------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------- | ------------- | ----------------------------------------------------------------------------- |
| DS-TOKEN-001   | Shared semantic token package                                        | Cross-platform design system | `packages/ui-tokens/`                                                                                   | Sections 2, 4, and 10           | Implemented | Pass          | [DS-TOKEN-001](#ds-token-001--shared-semantic-token-package)                  |
| WEB-SHELL-001  | Public header, footer, and site icon                                  | Web shell                    | `apps/web/src/app/layout.tsx`; `apps/web/src/app/icon.tsx`; `apps/web/src/app/globals.css`; `apps/web/src/components/site-shell.tsx` | Sections 2, 5, 6, and 10        | Implemented | Needs changes | [WEB-SHELL-001](#web-shell-001--public-header-and-footer)                     |
| WEB-SHELL-002  | Administration shell                                                 | Web shell                    | `apps/web/src/app/globals.css`; `apps/web/src/components/admin/admin-shell.tsx`                         | Sections 5, 6, and 10           | Partial     | Needs changes | [WEB-SHELL-002](#web-shell-002--administration-shell)                         |
| WEB-NAV-001    | Breadcrumbs                                                          | Web navigation               | `apps/web/src/components/breadcrumbs.tsx`                                                               | Section 6                       | Implemented | Needs changes | —                                                                             |
| WEB-NAV-002    | Contextual public-league navigation                                  | Web navigation               | `apps/web/src/components/public-league-navigation.tsx`                                                  | PUB-21; PUB-01; Sections 5–6    | Implemented | Needs changes | [WEB-NAV-002](#web-nav-002--contextual-public-league-navigation)              |
| WEB-PRIM-001   | Page heading, status badge, and empty/service states                 | Web component set            | `apps/web/src/app/globals.css`; `apps/web/src/components/site-shell.tsx`                                | Sections 4 and 6; SYS-04        | Implemented | Needs changes | [WEB-PRIM-001](#web-prim-001--web-heading-status-and-system-state-primitives) |
| WEB-PRIM-002   | Form error summary, field error, and invalid-field attributes        | Web component set            | `apps/web/src/components/form-feedback.tsx`                                                             | Section 6 form behavior         | In progress | Needs changes | —                                                                             |
| WEB-DOMAIN-001 | Organization picker                                                  | Web interaction              | `apps/web/src/components/admin/organization-picker.tsx`                                                 | No exact match                  | Implemented | Spec needed   | —                                                                             |
| WEB-DOMAIN-002 | Season list                                                          | Web data display             | `apps/web/src/components/admin/season-list.tsx`                                                         | ADM-03                          | Partial     | Needs changes | —                                                                             |
| WEB-DOMAIN-003 | Team list                                                            | Web data display             | `apps/web/src/components/admin/team-list.tsx`                                                           | No exact administrative mapping | Partial     | Spec needed   | —                                                                             |
| WEB-DOMAIN-004 | Audit list                                                           | Web data display             | `apps/web/src/components/admin/audit-list.tsx`                                                          | ADM-56                          | Partial     | Needs changes | —                                                                             |
| WEB-DOMAIN-005 | Public schedule results                                              | Web interaction/data display | `apps/web/src/components/public-schedule.tsx`                                                           | PUB-03                          | Implemented | Needs changes | [WEB-DOMAIN-005](#web-domain-005--public-schedule-results)                    |
| WEB-DOMAIN-006 | Venue accordion and nested field table                              | Web interaction/data display | `apps/web/src/components/admin/venue-field-manager.tsx`                                                 | ADM-26                          | Implemented | Needs changes | [WEB-DOMAIN-006](#web-domain-006--venue-accordion-and-nested-field-table)     |
| WEB-DOMAIN-007 | League card list and lifecycle status                               | Web interaction/data display | `apps/web/src/components/admin/league-manager.tsx`                                                       | ADM-63                          | Implemented | Needs changes | [WEB-DOMAIN-007](#web-domain-007--league-card-list-and-lifecycle-status)       |
| MOB-PRIM-001   | Screen, heading, card, action, error, loading, and status primitives | Native component set         | `apps/mobile/app/_layout.tsx`; `apps/mobile/src/components/ui.tsx`                                      | Sections 4, 6, and 10           | Implemented | Needs changes | [MOB-PRIM-001](#mob-prim-001--native-ui-primitives-and-font-adapter)          |

The unimplemented `PUB`, `TEAM`, `ADM`, `MOB`, `SYS`, `ACC`, `DOC`, and `COM` catalog remains in the style guide and is intentionally not duplicated here. Add its entries to this register when implementation starts.

### Foundation audit evidence

- `packages/ui-tokens` now implements the locked Slate/Emerald/Gold primitives, accessible semantic action/status appearances, type/spacing/target/layout values, and web/native platform adapters. Exact-value and foreground/surface contrast tests pass.
- The changed web foundation consumes the shared CSS contract without feature-local hex/RGB values, bundles Roboto Flex locally, uses a finite status-tone map with visible labels and a neutral unknown fallback, and provides a compact semantic mobile menu that closes after route navigation.
- The native primitive set consumes the TypeScript contract, loads a local Expo-compatible Roboto Flex face, uses semantic action/status appearances, and distinguishes 44dp standard from 64dp scoring controls.
- The public schedule now provides combined Date, Team, Field, and Status filters, league-timezone date grouping, a sticky desktop filter region, visible result/reset/empty states, and single-DOM mobile-card reflow. Division remains absent because it is not present in the approved public DTO.
- The current public league, public team, administration, and mobile-home surfaces implement only subsets of their mapped specifications.
- The final 12-image public recapture uses synthetic records and was reviewed without clipping, horizontal overflow, broken styling, private data, favicon failure, console errors, or page errors.
- Automated token, component, lint, type, web-build, browser-flow, accessibility, zoom/reflow, keyboard/focus, reduced-motion, and minimum-target evidence exists. Twelve responsive public-web screenshots are retained. Real screen-reader, desktop Ctrl-Plus, physical-device/manual, and visual-regression review remain unavailable.

## Style review checklist

Every review record must address each item or mark it not applicable with a reason:

- [ ] Identity: stable register ID, guide ID, route or delivery channel, roles, primary goal/action, and target viewports are documented.
- [ ] Authority: relevant requirement IDs and privacy, legal, permission, audit, and publication constraints are linked and take precedence over illustrative copy.
- [ ] Visual foundation: Modern Field semantic tokens and Roboto Flex are used; feature code contains no one-off brand or status values.
- [ ] Components: shared primitives are reused or a justified design-system addition is recorded before a local variant is created.
- [ ] Layout: the correct public, administration, mobile, game-day, or output template is used; sticky regions and bounded overflow match the specification.
- [ ] Responsive behavior: mobile, tablet, and desktop reflow—or the specified print/message dimensions—has been exercised with retained evidence.
- [ ] Interaction sizing: standard targets are at least 44px/dp, scoring targets are at least 64px/dp, and mobile body/input text is at least 16px.
- [ ] States: applicable default, loading, empty, validation, error, permission-denied, offline/stale/synchronizing, success, and destructive-action states are designed and tested.
- [ ] Accessibility: status is not color-only; contrast, semantic headings, labels, focus, keyboard/touch operation, screen-reader output, ARIA-live behavior, zoom, and reduced motion are checked as applicable.
- [ ] Consequential actions: official, destructive, legal, financial, communication, waiver, correction, and AI publication flows include the required validation, confirmation, reason, attestation, human approval, and audit behavior.
- [ ] Output rules: applicable PDF/print, email, SMS, push, social, and QR specifications are satisfied.
- [ ] Evidence: automated checks plus desktop/mobile/tablet screenshots or output samples are linked; reviewer, date, guide revision, known gaps, and approved exceptions are recorded.

## Review-record template

Copy this section for each artifact under **Review records**. Do not replace the shared checklist above; record evidence for how each item was satisfied.

```markdown
### REGISTER-ID — Artifact name

- Guide specification and revision:
- Requirements and constraints:
- Reviewer and date:
- Viewports or output formats checked:
- Automated checks:
- Screenshot/output evidence:
- Checklist result: Pass / Needs changes / Blocked / Exempt with reason
- Gaps, exceptions, and follow-up:
```

## Design-system clarification resolutions

The initial foundation ambiguities were resolved on 2026-08-18 in the style guide and shared token contract. Page-specific gaps still prevent the affected page artifacts from passing their own reviews.

| ID         | Clarification                                                                                            | State    | Resolution                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-GAP-001 | Complete the semantic action, link, border, focus, disabled, typography, radius, and elevation contract. | Resolved | Section 4 now defines the implementation extensions; `packages/ui-tokens` exposes matching typed and CSS adapters with exact assertions. Icon tokens remain component-owned until an icon system enters scope. |
| UI-GAP-002 | Define `color.status.synchronizing`.                                                                     | Resolved | `synchronizing` is a distinct semantic name using the tested accessible info appearance.                                                                                                                       |
| UI-GAP-003 | Separate business workflow waiting from transport waiting.                                               | Resolved | `pendingSync` is transport-only; `workflowPending` represents review, certification, or attestation waiting.                                                                                                   |
| UI-GAP-004 | Reconcile the 80dvh modal maximum with mobile full-screen behavior.                                      | Resolved | The 80dvh limit applies on tablet/desktop; specified task dialogs may become full-screen or bottom sheets below 768px.                                                                                         |
| UI-GAP-005 | Define global form behavior.                                                                             | Resolved | Section 6 now covers persistent labels, required state, helper/error order, validation timing, disabled/read-only states, autofill/paste, and minimum field sizing.                                            |
| UI-GAP-006 | Define reduced-motion behavior for live/synchronization indicators.                                      | Resolved | Reduced-motion mode replaces pulses, animated transitions, and auto-scroll with static icons and visible state text while preserving progress information.                                                     |
| UI-GAP-007 | Define administration reflow expectations.                                                               | Resolved | Complex administration is desktop-first with a functional single-column/rail fallback and bounded overflow below 1024px unless a screen specification says otherwise.                                          |
| UI-GAP-008 | Define cross-platform units.                                                                             | Resolved | Web emits CSS px/rem from a 16px root; React Native consumes equivalent unitless density-independent numeric values through its adapter.                                                                       |

## Review records

### DS-TOKEN-001 — Shared semantic token package

- Guide specification and revision: Modern Field Sections 2, 4, and 10, revised 2026-08-18.
- Requirements and constraints: semantic names are shared while rendering adapters remain platform-specific; status is not color-only; standard targets are at least 44px/dp and scoring targets are at least 64px/dp; fonts are bundled locally.
- Reviewer and date: Codex, 2026-08-18.
- Viewports or output formats checked: CSS and React Native token adapters; viewport rendering is not applicable to this token-only artifact.
- Automated checks: `pnpm --filter @league/ui-tokens test` (4/4 passed, including locked primitives, local-font names, target dimensions, CSS/TypeScript alignment, and WCAG contrast pairs); package lint and typecheck passed.
- Screenshot/output evidence: Not applicable; no user-visible rendering is produced by the package itself.
- Checklist result: Pass.
- Gaps, exceptions, and follow-up: Iconography remains component-owned until a shared icon system is selected. Every consuming artifact still requires its own responsive, interaction, and accessibility review.

### WEB-PAGE-001 — League gateway and tenant entry

- Guide specification and revision: PUB-21 and Modern Field Sections 4–6 and 10, reviewed 2026-08-19.
- Requirements and constraints: public read-only gateway; one validated server-side featured-league
  pair; no tenant enumeration, guessing, first-row selection, unpublished identity, or private fields;
  canonical slugged destination; useful absent/invalid/withdrawn/unavailable states; 44px actions.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated Chromium at desktop, tablet/reflow, 393px mobile, and
  200% CDP zoom; private-LAN synthetic journey through the test origin on port `8088`.
- Automated checks: web unit tests passed 40/40; E2E passed 7/7; axe passed 4/4; the separate LAN
  journey passed 5/5. Runtime-dynamic rendering, keyboard/focus order, reduced motion, minimum targets,
  no horizontal overflow, no console/page errors, and `/icon` as `200 image/png` were verified.
- Screenshot/output evidence:
  [root desktop 1440](evidence/ui/2026-08-19-navigable-published-league/01-root-desktop-1440.png),
  [root mobile menu 393](evidence/ui/2026-08-19-navigable-published-league/02-root-mobile-menu-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: No real screen-reader, desktop Ctrl-Plus, or physical-device/manual
  review is available. The retained set does not include every service/configuration variant or a
  dedicated root 1024px image; automated state and reflow coverage does not replace that review.

### WEB-PAGE-011 — Public league home

- Guide specification and revision: PUB-01, reviewed 2026-08-19.
- Requirements and constraints: read only from the current published snapshot; show only basic
  published matchup data; do not invent canonical field/weather status, news, standings, scores, or
  records; provide clear schedule/team paths.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated Chromium desktop/tablet/mobile reflow and 200% CDP
  zoom; 1024px retained capture; private-LAN synthetic journey.
- Automated checks: E2E/axe and the 5/5 LAN journey passed; navigation/focus, headings, 44px targets,
  reduced motion, overflow, and browser-error checks passed.
- Screenshot/output evidence:
  [league home tablet 1024](evidence/ui/2026-08-19-navigable-published-league/03-league-home-tablet-1024.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Build remains Partial because the approved public contract has no
  canonical field status, human-approved news, or standings required by PUB-01. The fixed-date seed
  currently exercises the honest no-upcoming-games state rather than a live upcoming card. Real
  screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain unavailable.

### WEB-PAGE-012 — Public schedule explorer

- Guide specification and revision: PUB-03, reviewed 2026-08-19.
- Requirements and constraints: published DTO fields only; league-timezone grouping; combined Date,
  Team, Field, and Status controls; visible count/reset/empty states; safe directions; non-color status;
  aligned desktop rows and single-DOM mobile cards.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: retained 1440px, 1024px, and 393px captures plus automated
  desktop/mobile/200% CDP reflow and private-LAN review.
- Automated checks: web unit coverage verifies combined filters, reset, filtered-empty behavior,
  chronological local dates, UTC/local-date separation, DST, safe-direction fallback, and semantic
  final status. E2E 7/7, axe 4/4, and LAN 5/5 passed with headings/live regions, keyboard/focus, 44px
  targets, reduced motion, overflow, and browser-error checks.
- Screenshot/output evidence:
  [schedule default desktop 1440](evidence/ui/2026-08-19-navigable-published-league/04-schedule-default-desktop-1440.png),
  [schedule filtered tablet 1024](evidence/ui/2026-08-19-navigable-published-league/05-schedule-filtered-tablet-1024.png),
  [schedule default mobile 393](evidence/ui/2026-08-19-navigable-published-league/06-schedule-default-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Build remains Partial against PUB-03 because Division is absent from
  the approved public DTO and mobile uses stacked persistent controls rather than the specified
  collapsed filter control. The one-game live fixture cannot authentically produce a filtered-empty
  screenshot because every offered value matches; focused unit coverage verifies that state. Real
  screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain unavailable.

### WEB-PAGE-013 — Public team directory

- Guide specification and revision: PUB-11, reviewed 2026-08-19.
- Requirements and constraints: search only approved `publicName`; do not expose internal names,
  affiliations, records, rosters, or new fields; provide count/reset/filtered-empty states and large
  linked responsive cards.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: retained 1440px, 1024px, and 393px default/filtered/empty
  captures plus automated desktop/mobile/200% CDP reflow and private-LAN review.
- Automated checks: component coverage verifies public-name-only search and reset/empty behavior; E2E
  7/7, axe 4/4, and LAN 5/5 passed with live-region, keyboard/focus, target-size, reduced-motion,
  overflow, long-content, and browser-error checks.
- Screenshot/output evidence:
  [teams default desktop 1440](evidence/ui/2026-08-19-navigable-published-league/07-teams-default-desktop-1440.png),
  [teams filtered tablet 1024](evidence/ui/2026-08-19-navigable-published-league/08-teams-filtered-tablet-1024.png),
  [teams filtered-empty mobile 393](evidence/ui/2026-08-19-navigable-published-league/09-teams-filtered-empty-mobile-393.png),
  [teams default mobile 393](evidence/ui/2026-08-19-navigable-published-league/10-teams-default-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Build remains Partial against PUB-11 because approved public DTOs do
  not contain church affiliation, Division, or records. Real screen-reader, desktop Ctrl-Plus, and
  physical-device/manual review remain unavailable.

### WEB-PAGE-014 — Public team detail

- Guide specification and revision: PUB-12, reviewed 2026-08-19.
- Requirements and constraints: approved team identity and matching published games only; determine
  missing-team 404 before schedule loading; degrade schedule failure within its section; no invented
  record, affiliation, roster, coach, score, or statistics; logical `h1` → `h2` → `h3` headings.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: retained 1440px and 393px captures plus automated
  desktop/tablet/mobile/200% CDP reflow and private-LAN review.
- Automated checks: E2E verifies a published team detail and missing-team not-found behavior; E2E
  7/7, axe 4/4, and LAN 5/5 passed with headings/live regions, keyboard/focus, target-size, overflow,
  and browser-error checks. Code review confirms `teamSeasonId` matching and independent
  schedule-unpublished/unavailable branches.
- Screenshot/output evidence:
  [team detail desktop 1440](evidence/ui/2026-08-19-navigable-published-league/11-team-detail-desktop-1440.png),
  [team detail mobile 393](evidence/ui/2026-08-19-navigable-published-league/12-team-detail-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Build remains Partial against PUB-12 because record, approved roster,
  statistics, affiliation, and tabbed subviews are unavailable in the approved public contract. The
  unavailable-section branches have neither targeted route-test nor retained screenshot evidence.
  Real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain unavailable.

### WEB-PAGE-015 — Venues and fields

- Guide specification and revision: ADM-26 and Modern Field Sections 4–6, reviewed 2026-08-21.
- Requirements and constraints: tenant-scoped administration route; one `h1`; native keyboard-
  operable venue disclosure rows; nested fields; visible active/inactive text; bounded responsive
  reflow; loading, empty, permission, conflict, success, and service-error handling; no destructive
  deletion or public publication of directions.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; the authenticated accessibility journey ran in desktop and mobile projects.
- Automated checks: the web component suite passed 49/49; the functional Playwright suite passed 8/8;
  and the accessibility suite passed 6/6, including the venue journey 2/2 on desktop and mobile.
  Browser coverage verified authenticated navigation, real create/update operations, audit history,
  keyboard disclosure operation, 44px targets, long-content reflow, no horizontal page overflow, and
  no console or page errors.
- Screenshot/output evidence:
  [expanded desktop 1440](evidence/ui/2026-08-21-venue-field-management/01-venues-expanded-desktop-1440.png),
  [add-field form tablet 1024](evidence/ui/2026-08-21-venue-field-management/02-add-field-form-tablet-1024.png),
  [add-field form mobile 393](evidence/ui/2026-08-21-venue-field-management/03-add-field-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained captures were visually inspected and contain synthetic
  demo data only. Real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain
  unavailable. Field availability and schedule enforcement remain a separate planned slice.

### WEB-FORM-008 — Create or edit venue

- Guide specification and revision: ADM-62 plus Modern Field Section 6 form behavior, reviewed
  2026-08-21.
- Requirements and constraints: persistent required name label; explicit active state; inline create
  and edit panels that preserve page context; client and authoritative server validation; disabled
  competing actions during submission; success announcement and focus restoration; distinct duplicate-
  name, stale-version, permission, and unavailable feedback.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; desktop and mobile accessibility projects exercised the containing workbench.
- Automated checks: the web component suite passed 49/49, including required-state, validation,
  duplicate-submission, mutation-pending, conflict, announcement, and focus coverage. The functional
  Playwright suite passed 8/8 with a real venue create/update and audit check; axe passed 6/6 overall,
  including the venue journey 2/2 on desktop and mobile.
- Screenshot/output evidence:
  [surrounding venue workbench desktop 1440](evidence/ui/2026-08-21-venue-field-management/01-venues-expanded-desktop-1440.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained workbench capture was visually inspected and contains
  synthetic demo data only, but it does not show a venue create/edit panel. A venue-form-specific
  capture plus real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain
  outstanding.

### WEB-FORM-009 — Create or edit field

- Guide specification and revision: ADM-62 plus Modern Field Section 6 form behavior, reviewed
  2026-08-21.
- Requirements and constraints: persistent labels for required name and optional directions/fence
  distance; visible lights and active controls; 100–600 whole-foot validation when supplied; inline
  venue context; duplicate-submission prevention; success/focus handling; and distinct duplicate-name,
  stale-version, permission, and unavailable feedback. Directions remain plain text rather than
  executable HTML or an unchecked link.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; the expanded field form ran in desktop and mobile accessibility projects.
- Automated checks: the web component suite passed 49/49, including nullable attributes, invalid
  directions association, stale-value retention, mutation-pending, announcement, and focus coverage.
  The functional Playwright suite passed 8/8 with a real field create/update and audit check; axe
  passed 6/6 overall, including the expanded venue/field form 2/2 on desktop and mobile. Automated
  checks also verified 48px text inputs and 44px actions/toggles.
- Screenshot/output evidence:
  [add-field form tablet 1024](evidence/ui/2026-08-21-venue-field-management/02-add-field-form-tablet-1024.png),
  [add-field form mobile 393](evidence/ui/2026-08-21-venue-field-management/03-add-field-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained captures were visually inspected and contain synthetic
  demo data only. Real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain
  outstanding. Public directions publication stays out of scope until an allowlisted publication
  contract exists.

### WEB-DOMAIN-006 — Venue accordion and nested field table

- Guide specification and revision: ADM-26 and Modern Field Sections 4–6, reviewed 2026-08-21.
- Requirements and constraints: semantic native venue disclosures; name, non-color active state, and
  field count in each summary; complete field details in a nested desktop table that reflows to readable
  mobile cards; venue-local actions; safe wrapping for long names and directions; no duplicate
  accessible rendering or page-level horizontal overflow.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; expanded content ran in desktop and mobile accessibility projects.
- Automated checks: the web component suite passed 49/49 and covers disclosure/table content, plain-
  text directions, active state, lights, fence distance, in-place refresh, and task locking. The
  functional Playwright suite passed 8/8; axe passed 6/6 overall with the venue journey 2/2 on desktop
  and mobile. Keyboard Enter operation, 44px summaries/actions, long-token wrapping, and zero
  horizontal overflow were verified.
- Screenshot/output evidence:
  [expanded desktop 1440](evidence/ui/2026-08-21-venue-field-management/01-venues-expanded-desktop-1440.png),
  [nested workbench tablet 1024](evidence/ui/2026-08-21-venue-field-management/02-add-field-form-tablet-1024.png),
  [nested workbench mobile 393](evidence/ui/2026-08-21-venue-field-management/03-add-field-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained captures were visually inspected and contain synthetic
  demo data only. A dedicated collapsed-state capture and real screen-reader, desktop Ctrl-Plus, and
  physical-device/manual review remain outstanding before Pass.

### WEB-PAGE-016 — League basics

- Guide specification and revision: ADM-63 and Modern Field Sections 4–6, reviewed 2026-08-21.
- Requirements and constraints: explicit tenant-scoped administration route; one `h1`; responsive
  league cards; visible non-color active/inactive status; one primary Add League action; inline task
  context; loading, empty, permission, conflict, success, and service-error handling; no destructive
  deletion or implicit organization selection.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; the authenticated accessibility journey ran in desktop and mobile projects.
- Automated checks: API integration passed 14/14, the web unit suite passed 61/61, the functional
  Playwright suite passed 9/9, the accessibility suite passed 6/6, and the synthetic evidence run
  passed 1/1. Browser coverage verified authenticated navigation, dedicated synthetic create/update,
  HTTP 201/200 responses, audit history, keyboard operation, 44px targets, long-token reflow, no
  horizontal page overflow, and no console or page errors. The seeded `church-softball` public league
  was not edited.
- Screenshot/output evidence:
  [league basics desktop 1440](evidence/ui/2026-08-21-league-management/01-league-basics-desktop-1440.png),
  [league form tablet 1024](evidence/ui/2026-08-21-league-management/02-league-form-tablet-1024.png),
  [league form mobile 393](evidence/ui/2026-08-21-league-management/03-league-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained captures were visually inspected and contain synthetic
  demo data only. Real screen-reader, desktop Ctrl-Plus/browser-zoom, and physical-device/manual review
  remain unavailable. Zero-membership onboarding and operator provisioning/hardening are separate
  incomplete flows; this page serves already authorized organization members.

### WEB-FORM-010 — Create or edit league

- Guide specification and revision: ADM-63 plus Modern Field Section 6 form behavior, reviewed
  2026-08-21.
- Requirements and constraints: persistent required labels; 160-character name and 2–80-character
  lowercase-kebab slug validation; explicit Active state with associated help and a 44-by-44-pixel
  label target; single-task and mutation locking; stable idempotency keys for unchanged ambiguous
  retries; key rotation when payload or expected version changes; success announcement and focus
  restoration; retained values and explicit latest-value loading after a stale-version conflict; and
  distinct duplicate, published-slug-lock, inactive, permission, missing, and unavailable feedback.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; the expanded form ran in desktop and mobile accessibility projects.
- Automated checks: API integration passed 14/14 and the web unit suite passed 61/61, including
  strict validation, retry-key reuse/rotation, pending-state locking, explicit conflict recovery,
  accessible help/error associations, announcements, and focus coverage. The functional Playwright
  suite passed 9/9; axe passed 6/6 overall; and the synthetic evidence run passed 1/1. Automated checks
  also verified 48px text inputs, 44px actions, and an Active label at least 44px in both dimensions.
- Screenshot/output evidence:
  [league form tablet 1024](evidence/ui/2026-08-21-league-management/02-league-form-tablet-1024.png),
  [league form mobile 393](evidence/ui/2026-08-21-league-management/03-league-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained synthetic form captures were visually inspected. Real
  screen-reader, desktop Ctrl-Plus/browser-zoom, and physical-device/manual review remain outstanding
  before Pass.

### WEB-DOMAIN-007 — League card list and lifecycle status

- Guide specification and revision: ADM-63 and Modern Field Sections 4–6, reviewed 2026-08-21.
- Requirements and constraints: semantic list/card structure; deterministic name ordering; visible
  name, public URL slug, and non-color active/inactive status; specifically named Edit actions; inline
  edit context; safe long-token wrapping; responsive one-column reflow; and no page-level horizontal
  overflow.
- Reviewer and date: Codex, 2026-08-21.
- Viewports or output formats checked: automated Chromium at 1440px, 1024px, 393px, and 720px compact
  landscape reflow; league content ran in desktop and mobile accessibility projects.
- Automated checks: API integration passed 14/14, the web unit suite passed 61/61, the functional
  Playwright suite passed 9/9, axe passed 6/6, and the synthetic evidence run passed 1/1. Component
  coverage verified ordering, status and slug presentation, task locking, list refresh, and focus
  behavior. Browser checks verified the dedicated reusable league fixture, responsive reflow, safe
  long-token wrapping, keyboard operation, and zero horizontal overflow.
- Screenshot/output evidence:
  [league cards desktop 1440](evidence/ui/2026-08-21-league-management/01-league-basics-desktop-1440.png),
  [league workbench tablet 1024](evidence/ui/2026-08-21-league-management/02-league-form-tablet-1024.png),
  [league workbench mobile 393](evidence/ui/2026-08-21-league-management/03-league-form-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The retained captures were visually inspected and contain synthetic
  demo data only. Real screen-reader, desktop Ctrl-Plus/browser-zoom, and physical-device/manual review
  remain outstanding before Pass.

### WEB-FORM-006 — Public schedule filters

- Guide specification and revision: PUB-03 plus Section 6 form behavior, reviewed 2026-08-19.
- Requirements and constraints: persistent programmatic labels; combined Date/Team/Field/Status
  filtering; chronological league-local dates; visible polite atomic count; 44px controls; explicit
  reset and filtered-empty recovery; no unapproved Division field.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated desktop/tablet/mobile and 200% CDP reflow; retained
  schedule captures at 1440px, 1024px, and 393px.
- Automated checks: focused component coverage plus E2E 7/7, axe 4/4, and LAN 5/5 passed; keyboard,
  focus-visible, live-region, reduced-motion, target-size, and overflow checks passed.
- Screenshot/output evidence:
  [default desktop 1440](evidence/ui/2026-08-19-navigable-published-league/04-schedule-default-desktop-1440.png),
  [filtered tablet 1024](evidence/ui/2026-08-19-navigable-published-league/05-schedule-filtered-tablet-1024.png),
  [default mobile 393](evidence/ui/2026-08-19-navigable-published-league/06-schedule-default-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The bounded implemented form intentionally omits Division because no
  approved public field exists, and the mobile presentation does not use PUB-03's collapsed filter
  control. Filtered-empty is unit-tested but lacks an authentic live screenshot. Real screen-reader,
  desktop Ctrl-Plus, and physical-device/manual review remain unavailable.

### WEB-FORM-007 — Public team-name search

- Guide specification and revision: PUB-11 plus Section 6 form behavior, reviewed 2026-08-19.
- Requirements and constraints: persistent label; search only normalized approved `publicName`; visible
  polite atomic count; 44px search/reset controls; explicit reset and filtered-empty recovery; no
  internal-name, affiliation, Division, or record search.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated desktop/tablet/mobile and 200% CDP reflow; retained
  default, filtered, and filtered-empty team captures at 1440px, 1024px, and 393px.
- Automated checks: focused component coverage plus E2E 7/7, axe 4/4, and LAN 5/5 passed; keyboard,
  focus-visible, live-region, reduced-motion, target-size, long-content, and overflow checks passed.
- Screenshot/output evidence:
  [default desktop 1440](evidence/ui/2026-08-19-navigable-published-league/07-teams-default-desktop-1440.png),
  [filtered tablet 1024](evidence/ui/2026-08-19-navigable-published-league/08-teams-filtered-tablet-1024.png),
  [filtered-empty mobile 393](evidence/ui/2026-08-19-navigable-published-league/09-teams-filtered-empty-mobile-393.png),
  [default mobile 393](evidence/ui/2026-08-19-navigable-published-league/10-teams-default-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The implemented bounded search intentionally omits unavailable
  affiliation/Division controls. Real screen-reader, desktop Ctrl-Plus, and physical-device/manual
  review remain unavailable.

### WEB-NAV-002 — Contextual public-league navigation

- Guide specification and revision: PUB-21, PUB-01, and Modern Field Sections 5–6, reviewed 2026-08-19.
- Requirements and constraints: semantic Home/Schedule/Teams/Staff sign-in destinations; current page
  visible without color alone; current published-season context; 44px targets; compact sticky desktop
  navigation; logical mobile disclosure that closes after route navigation.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated desktop/tablet/mobile and 200% CDP reflow; retained
  desktop and open-menu mobile captures; complete private-LAN root-to-team journey.
- Automated checks: focused navigation coverage plus E2E 7/7, axe 4/4, and LAN 5/5 passed. Keyboard
  activation, focus-visible styling, route-current state, post-navigation mobile closure, reduced
  motion, minimum targets, overflow, and browser errors were checked.
- Screenshot/output evidence:
  [root desktop 1440](evidence/ui/2026-08-19-navigable-published-league/01-root-desktop-1440.png),
  [root mobile menu 393](evidence/ui/2026-08-19-navigable-published-league/02-root-mobile-menu-393.png),
  [league context tablet 1024](evidence/ui/2026-08-19-navigable-published-league/03-league-home-tablet-1024.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Real screen-reader, desktop Ctrl-Plus, and physical-device/manual
  review remain unavailable.

### WEB-DOMAIN-005 — Public schedule results

- Guide specification and revision: PUB-03 and Modern Field Sections 4–6, reviewed 2026-08-19.
- Requirements and constraints: one semantic collection grouped by league-local date; aligned desktop
  fields and stacked mobile cards without duplicated accessible game content; exact non-color status
  wording; safe HTTP/HTTPS directions with text fallback; logical reusable heading levels.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated desktop/tablet/mobile and 200% CDP reflow; retained
  schedule captures at 1440px, 1024px, and 393px plus team-detail captures at 1440px and 393px.
- Automated checks: focused component coverage verifies timezone/DST grouping, chronological ordering,
  one rendered game instance, exact `Official Final`, safe directions, invalid-date/timezone fallback,
  and reusable `h3` grouping. E2E 7/7, axe 4/4, and LAN 5/5 passed.
- Screenshot/output evidence:
  [schedule desktop 1440](evidence/ui/2026-08-19-navigable-published-league/04-schedule-default-desktop-1440.png),
  [schedule tablet 1024](evidence/ui/2026-08-19-navigable-published-league/05-schedule-filtered-tablet-1024.png),
  [schedule mobile 393](evidence/ui/2026-08-19-navigable-published-league/06-schedule-default-mobile-393.png),
  [team detail desktop 1440](evidence/ui/2026-08-19-navigable-published-league/11-team-detail-desktop-1440.png),
  [team detail mobile 393](evidence/ui/2026-08-19-navigable-published-league/12-team-detail-mobile-393.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Real screen-reader output and physical/manual visual review remain
  unavailable. The live fixture exercises one game; multi-game/date/status behavior is demonstrated by
  focused unit fixtures rather than retained screenshots.

### WEB-SHELL-001 — Public header, footer, and site icon

- Guide specification and revision: Modern Field Sections 2 and 4–6 plus PUB-21, reviewed 2026-08-19.
- Requirements and constraints: locally bundled Roboto Flex, compact sticky header, semantic responsive
  navigation, 44px controls, visible focus/current state, reduced-motion support, and a recognizable
  locally rendered site icon.
- Reviewer and date: Codex, 2026-08-19.
- Viewports or output formats checked: automated desktop/tablet/mobile and 200% CDP reflow, retained
  1440px/1024px/393px public captures, and the private-LAN synthetic journey.
- Automated checks: web unit tests passed 40/40, E2E passed 7/7, axe passed 4/4, and LAN passed 5/5.
  Keyboard/focus, mobile-menu closure, reduced motion, minimum targets, overflow, CSP/hydration,
  compressed static assets, browser errors, and `/icon` as `200 image/png` were verified.
- Screenshot/output evidence:
  [root desktop 1440](evidence/ui/2026-08-19-navigable-published-league/01-root-desktop-1440.png),
  [root mobile menu 393](evidence/ui/2026-08-19-navigable-published-league/02-root-mobile-menu-393.png),
  [league home tablet 1024](evidence/ui/2026-08-19-navigable-published-league/03-league-home-tablet-1024.png).
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Real screen-reader, desktop Ctrl-Plus, and physical-device/manual
  review remain unavailable; retained images are implementation evidence rather than a visual-
  regression baseline.

### WEB-SHELL-002 — Administration shell

- Guide specification and revision: Modern Field Sections 5, 6, and 10, revised 2026-08-18.
- Requirements and constraints: sticky 240px desktop sidebar, functional single-column fallback, bounded content, semantic colors, and 44px navigation targets.
- Reviewer and date: Codex, 2026-08-18.
- Viewports or output formats checked: the desktop administration flow passed Chromium E2E; responsive CSS was reviewed in code, but mobile administration has no retained screenshot or manual review.
- Automated checks: web unit tests (20/20), browser E2E (4/4), and desktop/Pixel 7 axe scans (2/2) passed with lint, typecheck, and production build.
- Screenshot/output evidence: None recorded.
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: The current slice has a sticky sidebar and mobile fallback but not the complete collapsible rail/utility-bar workbench. Visual, keyboard, screen-reader, and dense-overflow checks remain.

### WEB-PRIM-001 — Web heading, status, and system-state primitives

- Guide specification and revision: Modern Field Sections 4 and 6 plus SYS-04, revised 2026-08-18.
- Requirements and constraints: finite semantic status mapping, visible text, safe neutral fallback, local tokens only, and accessible alert/loading semantics.
- Reviewer and date: Codex, 2026-08-18.
- Viewports or output formats checked: desktop Chromium and Pixel 7 emulation passed automated entry-page accessibility checks; no retained screenshots or manual assistive-technology review.
- Automated checks: web unit tests (20/20) cover published/scheduled/final/draft/postponed mappings, unknown neutral fallback, receiver-safe API calls, and explicit web audit attribution; browser E2E (4/4), desktop/Pixel 7 axe scans (2/2), lint, typecheck, and production build passed.
- Screenshot/output evidence: None recorded.
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Complete contrast-in-context, keyboard, zoom, screen-reader announcement, and responsive visual checks on consuming pages.

### MOB-PRIM-001 — Native UI primitives and font adapter

- Guide specification and revision: Modern Field Sections 4, 6, and 10, revised 2026-08-18.
- Requirements and constraints: Expo-compatible local Roboto Flex, density-independent shared values, semantic action/status appearances, visible status labels, 44dp default targets, and 64dp scoring targets.
- Reviewer and date: Codex, 2026-08-18.
- Viewports or output formats checked: Android and iOS bundles exported successfully; no emulator or physical-device viewport was reviewed.
- Automated checks: mobile tests (17/17 across two suites), lint, and typecheck passed; tests cover font mapping, actions, semantic statuses, neutral fallback, disabled behavior, target sizes, receiver-safe API calls, and explicit mobile audit attribution. `pnpm --filter @league/mobile build` exported Android and iOS bundles and included `RobotoFlex_400Regular.ttf`.
- Screenshot/output evidence: None recorded.
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Complete Android/iOS device or emulator visual, dynamic-type, TalkBack/VoiceOver, touch, dark/system-setting, and reduced-motion checks before Pass.
