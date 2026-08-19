# UI artifact register

Last updated: 2026-08-19

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
| WEB-PAGE-001  | League Hub landing `/`                                                                              | Web page            | `apps/web/src/app/page.tsx`                                                                               | No exact match                                   | Implemented | Spec needed   | —             |
| WEB-PAGE-002  | Sign in `/sign-in`                                                                                  | Web page            | `apps/web/src/app/sign-in/page.tsx`                                                                       | SYS-01                                           | Implemented | Needs changes | —             |
| WEB-PAGE-003  | Organization chooser `/admin/organizations`                                                         | Web page            | `apps/web/src/app/admin/organizations/page.tsx`                                                           | No exact match                                   | Implemented | Spec needed   | —             |
| WEB-PAGE-004  | Organization command center `/admin/{organizationId}`                                               | Web page            | `apps/web/src/app/admin/[organizationId]/page.tsx`                                                        | ADM-01                                           | Partial     | Needs changes | —             |
| WEB-PAGE-005  | Season list `/admin/{organizationId}/seasons`                                                       | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/page.tsx`                                                | ADM-03                                           | Partial     | Needs changes | —             |
| WEB-PAGE-006  | New season `/admin/{organizationId}/seasons/new`                                                    | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/new/page.tsx`                                            | ADM-03 (partial; guide specifies a wizard/modal) | Partial     | Needs changes | —             |
| WEB-PAGE-007  | Season editor `/admin/{organizationId}/seasons/{seasonId}`                                          | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/page.tsx`                                     | ADM-03/ADM-04 overlap; exact workspace missing   | Partial     | Spec needed   | —             |
| WEB-PAGE-008  | New administrative team `/admin/{organizationId}/seasons/{seasonId}/teams/new`                      | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/teams/new/page.tsx`                           | No exact match                                   | Implemented | Spec needed   | —             |
| WEB-PAGE-009  | Administrative team editor `/admin/{organizationId}/seasons/{seasonId}/teams/{teamSeasonId}`        | Web page            | `apps/web/src/app/admin/[organizationId]/seasons/[seasonId]/teams/[teamSeasonId]/page.tsx`                | No exact match; ADM-15 is roster detail          | Partial     | Spec needed   | —             |
| WEB-PAGE-010  | Audit explorer `/admin/{organizationId}/audit`                                                      | Web page            | `apps/web/src/app/admin/[organizationId]/audit/page.tsx`                                                  | ADM-56                                           | Partial     | Needs changes | —             |
| WEB-PAGE-011  | Public league home `/leagues/{organizationSlug}/{leagueSlug}`                                       | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/page.tsx`                                       | PUB-01                                           | Partial     | Needs changes | —             |
| WEB-PAGE-012  | Public schedule explorer `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/schedule`   | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/schedule/page.tsx`         | PUB-03                                           | Partial     | Needs changes | —             |
| WEB-PAGE-013  | Public team directory `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/teams`         | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/teams/page.tsx`            | PUB-11                                           | Partial     | Needs changes | —             |
| WEB-PAGE-014  | Public team detail `/leagues/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/teams/{teamSlug}` | Web page            | `apps/web/src/app/leagues/[organizationSlug]/[leagueSlug]/seasons/[seasonSlug]/teams/[teamSlug]/page.tsx` | PUB-12                                           | Partial     | Needs changes | —             |
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
| MOB-FORM-001 | Sign in                              | Native form | `apps/mobile/app/(auth)/sign-in.tsx`                   | MOB-01                                    | Implemented | Needs changes | —             |

## Current shared-foundation baseline

| Register ID    | Artifact                                                             | Surface/type                 | Source                                                                                                  | Guide mapping                   | Build       | Style review  | Review record                                                                 |
| -------------- | -------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------- | ------------- | ----------------------------------------------------------------------------- |
| DS-TOKEN-001   | Shared semantic token package                                        | Cross-platform design system | `packages/ui-tokens/`                                                                                   | Sections 2, 4, and 10           | Implemented | Pass          | [DS-TOKEN-001](#ds-token-001--shared-semantic-token-package)                  |
| WEB-SHELL-001  | Public header and footer                                             | Web shell                    | `apps/web/src/app/layout.tsx`; `apps/web/src/app/globals.css`; `apps/web/src/components/site-shell.tsx` | Sections 5, 6, and 10           | Implemented | Needs changes | [WEB-SHELL-001](#web-shell-001--public-header-and-footer)                     |
| WEB-SHELL-002  | Administration shell                                                 | Web shell                    | `apps/web/src/app/globals.css`; `apps/web/src/components/admin/admin-shell.tsx`                         | Sections 5, 6, and 10           | Partial     | Needs changes | [WEB-SHELL-002](#web-shell-002--administration-shell)                         |
| WEB-NAV-001    | Breadcrumbs                                                          | Web navigation               | `apps/web/src/components/breadcrumbs.tsx`                                                               | Section 6                       | Implemented | Needs changes | —                                                                             |
| WEB-PRIM-001   | Page heading, status badge, and empty/service states                 | Web component set            | `apps/web/src/app/globals.css`; `apps/web/src/components/site-shell.tsx`                                | Sections 4 and 6; SYS-04        | Implemented | Needs changes | [WEB-PRIM-001](#web-prim-001--web-heading-status-and-system-state-primitives) |
| WEB-PRIM-002   | Form error summary, field error, and invalid-field attributes        | Web component set            | `apps/web/src/components/form-feedback.tsx`                                                             | Section 6 form behavior         | In progress | Needs changes | —                                                                             |
| WEB-DOMAIN-001 | Organization picker                                                  | Web interaction              | `apps/web/src/components/admin/organization-picker.tsx`                                                 | No exact match                  | Implemented | Spec needed   | —                                                                             |
| WEB-DOMAIN-002 | Season list                                                          | Web data display             | `apps/web/src/components/admin/season-list.tsx`                                                         | ADM-03                          | Partial     | Needs changes | —                                                                             |
| WEB-DOMAIN-003 | Team list                                                            | Web data display             | `apps/web/src/components/admin/team-list.tsx`                                                           | No exact administrative mapping | Partial     | Spec needed   | —                                                                             |
| WEB-DOMAIN-004 | Audit list                                                           | Web data display             | `apps/web/src/components/admin/audit-list.tsx`                                                          | ADM-56                          | Partial     | Needs changes | —                                                                             |
| WEB-DOMAIN-005 | Public schedule results                                              | Web interaction/data display | `apps/web/src/components/public-schedule.tsx`                                                           | PUB-03                          | Partial     | Needs changes | —                                                                             |
| MOB-PRIM-001   | Screen, heading, card, action, error, loading, and status primitives | Native component set         | `apps/mobile/app/_layout.tsx`; `apps/mobile/src/components/ui.tsx`                                      | Sections 4, 6, and 10           | Implemented | Needs changes | [MOB-PRIM-001](#mob-prim-001--native-ui-primitives-and-font-adapter)          |

The unimplemented `PUB`, `TEAM`, `ADM`, `MOB`, `SYS`, `ACC`, `DOC`, and `COM` catalog remains in the style guide and is intentionally not duplicated here. Add its entries to this register when implementation starts.

### Foundation audit evidence

- `packages/ui-tokens` now implements the locked Slate/Emerald/Gold primitives, accessible semantic action/status appearances, type/spacing/target/layout values, and web/native platform adapters. Exact-value and foreground/surface contrast tests pass.
- The changed web foundation consumes the shared CSS contract without feature-local hex/RGB values, bundles Roboto Flex locally, uses a finite status-tone map with visible labels and a neutral unknown fallback, and provides a compact semantic mobile menu.
- The native primitive set consumes the TypeScript contract, loads a local Expo-compatible Roboto Flex face, uses semantic action/status appearances, and distinguishes 44dp standard from 64dp scoring controls.
- The public schedule does not yet provide the specified filter set, date grouping, sticky filter bar, or mobile-card reflow.
- The current public league, public team, administration, and mobile-home surfaces implement only subsets of their mapped specifications.
- Automated token, component, lint, type, web-build, and Android/iOS export evidence exists. No responsive screenshot baselines, emulator/physical-device visual review, screen-reader review, or visual-regression checks have been recorded yet.

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

### WEB-SHELL-001 — Public header and footer

- Guide specification and revision: Modern Field Sections 4–6 and 10, revised 2026-08-18.
- Requirements and constraints: locally bundled Roboto Flex, sticky compact header, semantic responsive navigation, 44px controls, visible focus, and reduced-motion support.
- Reviewer and date: Codex, 2026-08-18.
- Viewports or output formats checked: desktop Chromium and Pixel 7 emulation passed automated flow/accessibility checks; no retained screenshots or manual assistive-technology review.
- Automated checks: web unit tests (20/20), browser E2E (4/4), and desktop/Pixel 7 axe scans (2/2) passed with lint, typecheck, and production build; tests cover mobile-menu semantics, status fallback behavior, CSP nonce hydration, and compressed static assets.
- Screenshot/output evidence: None recorded.
- Checklist result: Needs changes.
- Gaps, exceptions, and follow-up: Capture desktop/tablet/mobile screenshots and complete keyboard, zoom, reduced-motion, and screen-reader review before Pass.

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
