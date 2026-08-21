# League App UI Style Guide

> **Source:** *Softball League Design System Foundation - Google Gemini* (98-page PDF, converted to Markdown on 2026-08-18).
>
> **Scope:** This file is a visual design and UI implementation reference for `dopple444/League_App`. Existing product, legal, security, privacy, and acceptance requirements remain authoritative. If illustrative wording or behavior in this guide conflicts with `AGENTS.md`, `IMPLEMENT.md`, or files under `docs/`, those project requirements control.
>
> **Asset note:** The source PDF contains text-based specifications but no embedded page-mockup image assets. Mockup filenames below are design deliverable references, not files extracted from the PDF.
>
> **Implementation tracking:** Register every new or materially changed page, screen, form, component, or generated artifact in [`UI_ARTIFACT_REGISTER.md`](UI_ARTIFACT_REGISTER.md) and complete its review record before marking it style compliant.

## 1. Design principles and brand personality

- **Trust and authority:** Convey absolute reliability for legal waivers, financial transactions, and official game records.
- **Error prevention (Poka-Yoke):** Consequential actions such as submitting an official scorebook or publishing a schedule require strict validation gates and human approval.
- **Contextual efficiency:** Game-day interfaces prioritize scoring and synchronization above the fold, minimizing cognitive load for volunteers in stressful outdoor environments.
- **Seamless translation:** Use predictable token and component naming so the design maps cleanly to modular front-end code and utility-class frameworks such as Tailwind CSS.

## 2. Visual direction evaluation

| Direction | Primary palette | Typography | Vibe and usability |
| --- | --- | --- | --- |
| Classic Diamond | Navy foundation, Forest Green accent, Off-white surface | Merriweather headings, Inter body | Traditional and reliable, but potentially dated or visually heavy on small screens. |
| **Modern Field - selected** | Slate Gray foundation, Emerald primary, Gold warning/accent | Roboto Flex for headings and body | Clean, highly accessible, and readily translated into standard digital design tokens. |
| High-Contrast Vector | Charcoal background, Bright Lime primary, Amber accent | Montserrat headings, Open Sans body | Sharp and sunlight-friendly, but potentially fatiguing during long administration sessions. |

### Final selection: Modern Field

Modern Field is the locked visual direction. It balances modern web aesthetics with WCAG 2.2 AA accessibility. Slate Gray provides softer contrast than stark black for data-heavy administrative work, Emerald references the sport without literal grass textures, and Roboto Flex supports responsive weight tuning without multiple font families. A dedicated **Sunlight Mode** uses maximum black-and-white contrast for mobile scorekeeping.

## 3. Information architecture

| Domain | Primary navigation | Subviews and workflows |
| --- | --- | --- |
| Public web | Home, Schedule, Standings, Teams, News | Rules and forms, field directions, live game viewer, canonical weather status |
| Authenticated portal | Dashboard, Season, Teams, Schedule, Game Day | Roster eligibility, waivers, finance, announcements, umpire assignments |
| Native mobile | Home, Schedule, Game Day, My Team, More | Distraction-free scorekeeping, live synchronization status, offline queue |

## 4. Design tokens

These semantic tokens are the machine-readable foundation for the web and React Native themes.

> **Editorial normalization:** The PDF visually placed `spacing` inside `typography`, which would create an awkward token API. It is shown as a top-level token group here for implementation clarity; the token names and values are unchanged.

```json
{
  "color": {
    "background": {
      "canvas": "#F8FAFC",
      "surface": "#FFFFFF",
      "surfaceMuted": "#F1F5F9",
      "inverse": "#0F172A"
    },
    "text": {
      "primary": "#0F172A",
      "muted": "#64748B",
      "inverse": "#F8FAFC"
    },
    "status": {
      "success": "#10B981",
      "warning": "#F59E0B",
      "danger": "#EF4444",
      "info": "#3B82F6",
      "offline": "#94A3B8",
      "live": "#10B981",
      "pendingSync": "#F59E0B",
      "officialFinal": "#0F172A",
      "synchronizing": "#3B82F6",
      "workflowPending": "#F59E0B"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": ["Roboto Flex", "ui-sans-serif", "system-ui", "sans-serif"]
    }
  },
  "spacing": {
    "base": "4px",
    "touchTargetMin": "44px",
    "scoringTargetMin": "64px"
  }
}
```

### Core token guidance

- Never hardcode one-off colors in feature components; consume semantic theme tokens.
- Status must use visible text and/or an icon in addition to color.
- Standard touch targets are at least 44px; primary scoring controls are at least 64px.
- Default body text is 16px or larger on mobile.
- Raw `color.status` values are indicators, data-visualization fills, or large non-text surfaces. Do not use them as small text on white. Use the accessible foreground/surface/border pairs below for badges and messages.
- `pendingSync` is reserved for locally saved work awaiting transport to the server. `workflowPending` represents a business process awaiting review, certification, or attestation even when connectivity is healthy.

### Implementation token extensions

The following semantic values complete the locked source palette for accessible implementation. They are centralized in `packages/ui-tokens`; feature code must not substitute local variants.

| Token | Default or indicator | Foreground | Surface | Border / hover / pressed |
| --- | --- | --- | --- | --- |
| `color.action.primary` | `#047857` | `#F8FAFC` | — | Hover `#065F46`; pressed `#064E3B` |
| `color.action.secondary` | `#FFFFFF` | `#047857` | — | Border `#047857`; hover `#ECFDF5`; pressed `#D1FAE5` |
| `color.action.destructive` | `#B91C1C` | `#FFFFFF` | — | Hover `#991B1B`; pressed `#7F1D1D` |
| `color.action.disabled` | — | `#475569` | `#E2E8F0` | Border `#CBD5E1` |
| `color.status.success` / `live` | `#10B981` | `#065F46` | `#D1FAE5` | `#6EE7B7` |
| `color.status.warning` / `pendingSync` / `workflowPending` | `#F59E0B` | `#92400E` | `#FEF3C7` | `#FCD34D` |
| `color.status.danger` | `#EF4444` | `#991B1B` | `#FEE2E2` | `#FCA5A5` |
| `color.status.info` / `synchronizing` | `#3B82F6` | `#1E40AF` | `#DBEAFE` | `#93C5FD` |
| `color.status.offline` | `#94A3B8` | `#475569` | `#F1F5F9` | `#CBD5E1` |
| `color.status.officialFinal` | `#0F172A` | `#F8FAFC` | `#0F172A` | `#0F172A` |

Additional shared values are `color.border.subtle = #CBD5E1`, `color.border.interactive = #64748B`, `color.border.focus = #2563EB`, and `color.border.invalid = #DC2626`. Roboto Flex uses a 12/14/16/20/28/44px type scale, weights 400/500/600/700/800, tight line height `1.15`, and body line height `1.55`. The spacing scale is 4/8/12/16/24/32/48/64, radii are 6/12/20px plus pill, the public content width is 1280px, and the administration sidebar is 240px.

On web, sizes are emitted as CSS pixels or equivalent `rem` values based on a 16px root. React Native consumes the same numeric spacing, radius, type-size, 44, and 64 values as unitless density-independent pixels. This is a semantic-value contract, not a requirement to share rendering components between platforms.

## 5. Responsive layout templates

- **Public shell:** Centered maximum-width container of 1280px, sticky compact header, and responsive menu below 768px.
- **Admin workbench:** 100dvh application shell, 240px collapsible left sidebar, sticky utility bar, and bounded internal table/grid scrolling rather than page-level overflow.
- **Mobile task screen:** 100dvh with no more than five bottom-navigation items and a sticky bottom action bar for wizard steps.
- **Game-day mode:** Fixed scoreboard header, persistently visible synchronization badge, and a main scoring pad that does not require vertical scrolling.

### Breakpoints and reflow

- **Mobile:** Below 768px - one column, bottom navigation, full-screen dialogs, and bottom sheets.
- **Tablet:** 768px through 1024px - two columns, rail navigation, and landscape game-day overrides.
- **Desktop:** Above 1024px - 240px administration sidebar, split-pane workbenches, and bounded internal scroll regions.

Complex administration is desktop-first. Below 1024px it must retain a functional single-column or rail-based fallback, keyboard access, and bounded horizontal scrolling for dense data; it does not require a separate mobile-native administration experience unless a screen specification says so.

## 6. Component inventory

- **Navigation:** Top Bar, Side Rail, Bottom Tab Navigation, Breadcrumbs.
- **Actions:** Primary, Secondary, and Destructive Buttons; Icon Button (44px minimum); Floating Action Button.
- **Inputs:** Text Field, Select, Date Picker, Signature Canvas, Toggle, Radio Group.
- **Data display:** KPI Tile, Sticky-Header Data Table, Pagination, Status/Eligibility Badge, Avatar.
- **Overlays:** Modal Dialog (maximum 80dvh on tablet/desktop), Bottom Sheet, Toast Notification. Below 768px, specified task dialogs may become full-screen; this is the intentional mobile exception to the desktop modal limit.

### Form behavior

- Place a persistent text label above each field. Placeholder text may provide an example but never replaces the label.
- Mark required fields in visible text and expose the required state programmatically. Explain the marker once near the start of long forms.
- Put helper text before validation errors in reading order. Associate helper and error text with the control, set `aria-invalid` or the native equivalent, and provide a focusable error summary for multi-field web forms.
- Validate on submit and, after the first failed submission, on blur or correction. Do not interrupt initial entry with premature errors.
- Disabled and read-only states must be visually distinct, programmatically exposed, and still meet text contrast requirements. Never communicate disabled state through opacity alone.
- Preserve browser/password-manager autofill and appropriate input-purpose metadata. Do not block paste in credentials, MFA, contact, or legal fields.
- Text inputs and selects are at least 48px/dp high; mobile input text is at least 16px.

### Motion

Honor the platform reduced-motion preference. Replace pulses, animated status transitions, and auto-scrolling effects with a static icon plus visible state text; essential progress remains available without animation.

## 7. Initial anchor screens

The source established these screens first to lock the system's visual language:

- PUB-01 - League Home
- PUB-03 - Schedule Explorer
- PUB-05 - Connected Live Game
- TEAM-05 - Roster and Eligibility
- ADM-01 - League Command Center
- ADM-31 - Visual Schedule Editor
- ADM-46 - Weather Decision Console
- ADM-50 - AI Recap Review
- MOB-13 - Live Scorekeeping
- MOB-20 - Submit Game Offline

The source does not provide explicit mockup filenames for PUB-01, ADM-31, MOB-13, or MOB-20. Their specifications are preserved below without invented asset links.

## 8. Screen and artifact specifications

### 8.1 Public website

#### PUB-01 - League Home

- **Layout:** Public responsive shell.
- **Above the fold:** Compact header with Meade County Church Softball League typography. A dynamic, high-contrast canonical banner displaying current field status (e.g., "Fields Open - Games on Schedule"). A grid of 4 compact KPI cards showing live/upcoming matchups.
- **Main content:** Two-column layout on desktop. Left column: Latest news feed (human-approved). Right column: Condensed league standings.
- **Components:** Top Bar, Canonical Status Banner, Matchup Card, Data Table (Condensed).

#### PUB-02 - Canonical league, field, and weather status page

- **Route and roles:** `/status` | Public (Read-only).
- **Primary goal and action:** Provide an unambiguous, single source of truth for weather and field playability.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A massive, high-visibility status card dominating the viewport. The text explicitly states the current status (e.g., "ALL FIELDS OPEN" or "GAMES DELAYED") paired with a clear `color.status` background (Emerald for open, Amber for delayed, Destructive for closed). An "Authorized Update" timestamp and the name of the official who published it are positioned directly beneath.
- **Sticky and scrollable regions:** Standard public header is sticky. The page itself is short and rarely requires scrolling.
- **Components:** Top Bar, Canonical Status Banner, KPI Tile (for individual field statuses), Breadcrumbs.
- **Variants and states:** Open, Delayed, Closed, Maintenance.
- **Responsive and accessibility:** The status card scales up to fill the primary mobile viewport so parents checking their phones in the car see the status instantly. High contrast is rigorously maintained.
- **Mockup filenames:** `PUB-02-canonical-status-desktop.png`, `PUB-02-canonical-status-mobile.png`.

#### PUB-03 - Schedule Explorer

- **Layout:** Public responsive shell.
- **Target viewport:** Desktop (1440) / Mobile (393).
- **Primary action:** Filter games by Date, Team, Field, Division, or Status.
- **Above the fold:** Page title "Schedule" with a sticky, horizontal filter bar underneath. On mobile, filters collapse into a single "Filters & Sort" segmented control to save vertical space.
- **Main content:** A list of games grouped by Date. Each row/card displays the Away vs. Home teams, Time, Field, and a clear Status badge (e.g., `color.status.live`, `color.status.officialFinal`).
- **Responsive behavior:** On desktop, results display in a clean list view with distinct columns. On mobile, this reflows into stacked matchup cards to maintain touch-target sizes.
- **Components:** Top Bar, Filter Selects, Date Group Header, Matchup Card, Status Badge.
- **Mockup filename:** `PUB-03-schedule-explorer-desktop.png`, `PUB-03-schedule-explorer-mobile.png`

#### PUB-04 - Scheduled game detail and share or QR view

- **Route and roles:** `/schedule/game/{id}` | Public (Read-only).
- **Primary goal and action:** View upcoming game logistics and share the event with others.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Large matchup header (Away vs. Home) with team logos (or placeholders). Key details: Date, Time, and Field Location. A prominent primary action button for "Share Game".
- **Sticky and scrollable regions:** Sticky share action on mobile.
- **Components:** Matchup Card, Share Modal/Drawer, QR Code Element, Map/Directions Link.
- **Variants and states:** Standard, Rescheduled (shows old time crossed out), Cancelled.
- **Responsive and accessibility:** Clicking "Share" on mobile opens a native bottom sheet containing the QR code and copyable link, preventing an unnecessary modal trap.
- **Mockup filenames:** `PUB-04-game-detail-desktop.png`, `PUB-04-game-share-mobile.png`.

#### PUB-05 - Connected Live Game

- **Layout:** Public responsive shell.
- **Target viewport:** Desktop (1440) / Mobile (393).
- **Primary action:** Read-only live play-by-play consumption.
- **Above the fold:** A compact persistent scoreboard. It features the current inning, outs, a subtle base diamond motif showing runners, and a "Live" badge (`color.status.live`) with a "Last updated: Just now" timestamp.
- **Main content:** Four primary tabs: Plays, Line Score, Lineups, Game Information. The default "Plays" tab displays a reverse-chronological event timeline (e.g., "Top 3rd: Smith singles to left field. Jones scores.").
- **Accessibility notes:** The live updates use ARIA live regions carefully configured to announce score changes or inning rollovers without overwhelming screen readers with every pitch.
- **Components:** Scoreboard Header, Base Diamond Motif, Status Badge, Tabs, Event Timeline List.
- **Mockup filename:** `PUB-05-connected-live-game-desktop.png`, `PUB-05-connected-live-game-mobile.png`

#### PUB-06 - Live game page with Live updates temporarily interrupted

- **Route and roles:** `/live/{id}` | Public (Read-only).
- **Primary goal and action:** Inform spectators of the last known score while clearly communicating a network interruption at the field.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Compact persistent scoreboard identical to PUB-05, but overlaid with an amber warning banner: "Live updates temporarily interrupted. Awaiting network reconnection from the scorekeeper." The Live badge changes to an amber "Offline" or "Sync Delayed" badge.
- **Sticky and scrollable regions:** Scoreboard and warning banner are sticky at the top. The play log scrolls internally.
- **Components:** Scoreboard Header, Warning Banner (`color.status.warning`), Tabs, Event Timeline List.
- **Variants and states:** Live updates temporarily interrupted.
- **Responsive and accessibility:** The interruption banner cannot be dismissed by the user. Screen readers announce the interruption state upon page load or polling failure.
- **Mockup filenames:** `PUB-06-live-interrupted-desktop.png`, `PUB-06-live-interrupted-mobile.png`.

#### PUB-07 - Submitted game awaiting official status

- **Route and roles:** `/game/{id}` | Public (Read-only).
- **Primary goal and action:** View post-game results that have not yet been certified by the umpire.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** The final score is displayed, but heavily badged with a muted, neutral indicator reading: "Submitted – Pending Official Umpire Attestation".
- **Sticky and scrollable regions:** Sticky game header. Scrollable box score tables.
- **Components:** Scoreboard Header, Status Badge (`color.status.workflowPending`), Data Table.
- **Variants and states:** Submitted awaiting attestation (`workflowPending`); locally queued submission or attestation (`pendingSync`).
- **Responsive and accessibility:** Ensures the word "Official" is completely absent from the page to prevent disputes before the umpire signs off.
- **Mockup filenames:** `PUB-07-submitted-pending-desktop.png`.

#### PUB-08 - Final or amended game, box score, and play-by-play archive

- **Route and roles:** `/game/{id}` | Public (Read-only).
- **Primary goal and action:** View the finalized, immutable record of a completed game.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Scoreboard displaying a stark, dark `color.status.officialFinal` badge.
- **Sticky and scrollable regions:** Sticky scoreboard. The content is separated into "Box Score" and "Play-by-Play" tabs. Box score tables use a horizontal bounded scroll region if columns exceed viewport width.
- **Components:** Scoreboard Header, Official Final Badge, Tabs, Data Table (Dense), Event Timeline.
- **Variants and states:** Official Final, Amended (with visible audit link to the change reason).
- **Responsive and accessibility:** Complex box scores on mobile use two-line rows or sticky player columns so the user doesn't lose context while scrolling horizontally.
- **Mockup filenames:** `PUB-08-official-box-score-desktop.png`, `PUB-08-official-box-score-mobile.png`.

#### PUB-09 - Standings with displayed tiebreaker explanation

- **Route and roles:** `/standings` | Public (Read-only).
- **Primary goal and action:** View league rankings and understand exactly why teams are positioned where they are.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Page title, Division filter, and the primary Standings Data Table (Rank, Team, W, L, T, PCT, GB, RS, RA).
- **Sticky and scrollable regions:** The table header is sticky. Immediately below the table is a sticky-bottom or clearly separated "Tiebreaker Rules Applied" informational card.
- **Components:** Data Table, Filter Select, Info Card.
- **Variants and states:** Mid-season, End-of-season.
- **Responsive and accessibility:** On mobile, secondary stats (RS, RA) are hidden behind a toggle or horizontal scroll, prioritizing W/L/T and Rank. Tiebreaker logic is explicitly spelled out (e.g., "Team A wins tiebreaker over Team B based on Head-to-Head record").
- **Mockup filenames:** `PUB-09-standings-desktop.png`, `PUB-09-standings-mobile.png`.

#### PUB-10 - Player and team statistical leaders

- **Route and roles:** `/leaders` | Public (Read-only).
- **Primary goal and action:** Celebrate top performers across various statistical categories.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Filter controls for Season, Division, and Category (Batting, Pitching, Fielding).
- **Main content:** A masonry or grid layout of "Leaderboard Cards" (e.g., Home Runs, Batting Average, RBI). Each card shows the top 3-5 players with their respective stats.
- **Sticky and scrollable regions:** Standard page scroll.
- **Components:** Filter Bar, Leaderboard Card, Avatar/Placeholder.
- **Variants and states:** Empty state for early season ("Not enough data to qualify").
- **Responsive and accessibility:** Grid collapses to a single column on mobile. Uses clear text labels, not just abbreviations, for screen readers (e.g., `aria-label="Runs Batted In"` for "RBI").
- **Mockup filenames:** `PUB-10-statistical-leaders-desktop.png`.

#### PUB-11 - Team directory

- **Route and roles:** `/teams` | Public (Read-only).
- **Primary goal and action:** Browse and navigate to all active teams in the league.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Search bar and Division/Church affiliation filters.
- **Main content:** A clean grid of Team Cards. Each card features the team name, affiliated church, current record, and a "View Team" action link.
- **Components:** Search Input, Filter Select, Team Card.
- **Variants and states:** Filtered empty state.
- **Responsive and accessibility:** Large touch targets on the Team Cards. Grid reflows from 3-4 columns on desktop to 1 column on mobile.
- **Mockup filenames:** `PUB-11-team-directory-desktop.png`, `PUB-11-team-directory-mobile.png`.

#### PUB-12 - Public team page with schedule, record, approved roster, and stats

- **Route and roles:** `/team/{id}` | Public (Read-only).
- **Primary goal and action:** Act as the home hub for a specific team's public information.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Team Header showing Name, Church, Coach (if public), and a quick-glance Win/Loss record.
- **Main content:** A segmented control/tab system: Schedule, Roster, Stats. The default "Schedule" tab shows past results and upcoming games.
- **Sticky and scrollable regions:** Team Header is sticky upon scrolling.
- **Components:** Page Header, Tabs, Matchup Card, Data Table (for Stats and Roster).
- **Variants and states:** Roster hidden before season start.
- **Responsive and accessibility:** Roster table limits columns on mobile to Jersey Number, Name, and Position.
- **Mockup filenames:** `PUB-12-team-page-desktop.png`, `PUB-12-team-page-mobile.png`.

#### PUB-13 - Public player or statistics page with privacy-controlled minor variant

- **Route and roles:** `/player/{id}` | Public (Read-only).
- **Primary goal and action:** View an individual player's performance while rigorously adhering to privacy configurations.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Player Header.
- **Main content:** Season stats tables, recent game logs.
- **Sticky and scrollable regions:** Standard page scroll.
- **Components:** Avatar, Profile Header, Data Table.
- **Variants and states:** Privacy-Controlled Minor Variant: If the player is a minor, the system enforces the guardian's privacy settings. The header strips the full name (e.g., displaying "J. Smith" or "Player #12"), removes the avatar, and disables links that could trace the player's identity across seasons. A small shield icon indicates restricted privacy.
- **Responsive and accessibility:** Privacy indicators are fully announced to screen readers.
- **Mockup filenames:** `PUB-13-player-stats-desktop.png`, `PUB-13-player-privacy-variant-mobile.png`.

#### PUB-14 - News, game-recap, and weekly-release index

- **Route and roles:** `/news` | Public (Read-only).
- **Primary goal and action:** Browse league announcements, recaps, and weekly releases.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A "Featured Story" hero card taking up the top span (e.g., "Week 4 Recap & Standings Update"). Below it, filter chips for "All", "Announcements", "Game Recaps", and "Press Releases".
- **Main content:** A responsive grid of news cards. Each card displays a thumbnail (if available, using authentic community placeholders), headline, date, and a brief excerpt.
- **Sticky and scrollable regions:** Standard page scroll.
- **Components:** Filter Chips, Article Card (Hero and Standard sizes), Pagination.
- **Variants and states:** Empty state if no news is published yet.
- **Responsive and accessibility:** The grid reflows from 3 columns on desktop to 1 column on mobile. Read-more links are adequately sized (minimum 44x44px touch targets).
- **Mockup filenames:** `PUB-14-news-index-desktop.png`, `PUB-14-news-index-mobile.png`.

#### PUB-15 - News article or weekly press release

- **Route and roles:** `/news/{id}` | Public (Read-only).
- **Primary goal and action:** Read a specific news article or weekly release.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Clean, distraction-free article header featuring the Headline, Date, and Author/Approver. If the article was AI-assisted (like a recap), a subtle badge reads "AI Drafted • Approved by [Human Name]" to ensure transparency.
- **Main content:** A single-column text layout optimized for readability (max width ~70ch). Weekly releases may include embedded tables for box scores or standings.
- **Sticky and scrollable regions:** Sticky share actions on the side (desktop) or bottom (mobile).
- **Components:** Article Header, Rich Text Block, Embedded Data Table, Share Button, Transparency Badge.
- **Variants and states:** Standard article, Weekly Release with embedded stats.
- **Responsive and accessibility:** High-contrast text (`color.text.primary` on `color.background.surface`). Embedded tables use horizontal scrolling on mobile to avoid breaking the layout.
- **Mockup filenames:** `PUB-15-news-article-desktop.png`.

#### PUB-16 - Rules, forms, waivers, and downloadable resources

- **Route and roles:** `/resources` | Public (Read-only).
- **Primary goal and action:** Provide easy access to immutable league rules, blank waiver templates, and printable forms.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Search bar specific to the resources directory.
- **Main content:** Categorized list or accordion groups: "League Rules", "Registration Forms", "Manager Resources". Each item features a distinct file-type icon (PDF, Word) and a "Download" or "View" action button.
- **Components:** Search Input, Accordion Group, Resource List Item, Button Secondary.
- **Variants and states:** Download initiated (loading state).
- **Responsive and accessibility:** Clear visual distinction between items that open a web page versus items that trigger a file download.
- **Mockup filenames:** `PUB-16-rules-forms-desktop.png`.

#### PUB-17 - Fields, directions, field status, parking, shelter, and safety information

- **Route and roles:** `/fields` | Public (Read-only).
- **Primary goal and action:** Help players and spectators locate fields and understand facility rules.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A map integration (or placeholder) showing all league field locations.
- **Main content:** A list of Field Cards. Each card includes the field name, current status badge (linked to the canonical status), address, and expandable sections for "Parking Details", "Shelter Availability", and "Safety Rules" (e.g., No Pets, No Alcohol).
- **Sticky and scrollable regions:** Map remains sticky on desktop while the field list scrolls.
- **Components:** Map Placeholder, Field Card, Status Badge, Accordion.
- **Variants and states:** Field closed (greys out the card slightly and applies a Destructive status badge).
- **Responsive and accessibility:** On mobile, the map is collapsed by default behind a "View on Map" toggle to save vertical space.
- **Mockup filenames:** `PUB-17-fields-directions-desktop.png`, `PUB-17-fields-directions-mobile.png`.

#### PUB-18 - About, contact, governance, and frequently asked questions

- **Route and roles:** `/about` | Public (Read-only).
- **Primary goal and action:** Provide organizational transparency and contact avenues.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Simple header and introduction to the Meade County Church Softball League.
- **Main content:** Three main sections: "Board of Directors" (listing elected officials), "Contact Us" (a secure web form to prevent email scraping), and a categorized FAQ accordion.
- **Components:** Contact Form, Avatar List, Accordion (FAQ).
- **Variants and states:** Form validation errors, Form submission success.
- **Responsive and accessibility:** Standard responsive reflow.
- **Mockup filenames:** `PUB-18-about-governance-desktop.png`.

#### PUB-19 - Team registration landing page

- **Route and roles:** `/register` | Public (Read-only until sign-in).
- **Primary goal and action:** Persuade coaches to register and initiate the application process.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A clear, welcoming summary of the upcoming season's details (dates, fees, divisions). A prominent, high-contrast primary call-to-action: "Start Team Application".
- **Main content:** A timeline component outlining the registration steps (1. Apply, 2. Church Certification, 3. Roster Building, 4. Payment).
- **Components:** Timeline Graphic, Pricing Summary, Button Primary.
- **Variants and states:** Registration Open, Registration Closed (CTA disabled with explanation), Registration Waitlist.
- **Responsive and accessibility:** Large, distinct buttons.
- **Mockup filenames:** `PUB-19-team-registration-landing-desktop.png`.

#### PUB-20 - Privacy, terms, accessibility, and public account or data-request content template

- **Route and roles:** `/legal` | Public (Read-only).
- **Primary goal and action:** Display required legal, privacy, and accessibility documentation.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Simple text header indicating the document title and "Last Updated" date.
- **Main content:** Long-form text. A sticky table of contents (left rail on desktop) allows users to jump to specific sections (e.g., "Data Deletion Requests").
- **Components:** Sticky TOC, Rich Text Block.
- **Responsive and accessibility:** TOC collapses into a standard dropdown or accordion on mobile.
- **Mockup filenames:** `PUB-20-legal-template-desktop.png`.

#### PUB-21 - League gateway and tenant entry

- **Route and roles:** `/` | Public (Read-only).
- **Primary goal and action:** Give a visitor a clear, trustworthy path into one explicitly configured
  league's published experience without requiring authentication, guessing a deep link, or exposing a
  directory of platform tenants. The primary action is "Open league"; "Staff sign in" is secondary.
- **Layout and target viewport:** Public responsive shell | Desktop (1440) / Tablet (1024) / Mobile
  (393).
- **Above the fold:** Compact public header, League Hub identity, concise explanation of the published
  information boundary, and a prominent featured-league card when a deployment-configured public
  organization/league pair resolves. The card shows only published organization and league names and
  links to the canonical slugged league home. It never displays internal identifiers, draft state, or
  private membership data.
- **Main content:** A short three-card orientation covering published schedules, approved public team
  pages, and attributable league administration. When no featured league is configured, replace the
  featured card with a neutral instruction to use the public link supplied by the visitor's league;
  do not list or search tenants. Staff sign-in remains available but is not the only way forward when
  a published featured league is configured.
- **Sticky and scrollable regions:** The standard public header remains sticky. Page content uses the
  bounded public content width and ordinary document scrolling; no nested scrolling region is
  introduced.
- **Components:** Top Bar, Featured League Card, Button Primary, Button Secondary, Feature Card,
  Service/Empty State.
- **Variants and states:** Configured published league; no configured league; configured league absent
  or withdrawn; public service temporarily unavailable. An absent or withdrawn configured league must
  not fall through to a different tenant.
- **Responsive and accessibility:** The featured-league action remains above the fold where practical,
  all actions are at least 44px, focus order follows reading order, focus is visible, and identity plus
  action meaning never relies on color alone. Cards stack in one column at mobile widths without
  horizontal viewport overflow. At 200% zoom, content reflows without obscuring the primary action.
  Reduced-motion preferences are honored by the shared shell.
- **Publication, privacy, and security constraints:** Featured league identity comes only from a
  validated server-side deployment configuration and the existing allowlisted public endpoint. The
  page must not enumerate tenants, select the first database row, reveal configuration secrets, or
  render unpublished data. Failure copy must not imply an authorized field/weather decision or other
  official fact that is absent from the public payload.
- **Mockup filenames:** None established. Retain reviewed implementation screenshots at 1440px,
  1024px, and 393px before marking the artifact Pass.

### 8.2 Player, guardian, coach, and team portal

#### TEAM-01 - Role-aware personal or coach dashboard

- **Route and roles:** `/portal/dashboard` | Coach, Player, Guardian.
- **Primary goal and action:** Surface immediate tasks (waivers, RSVPs) and upcoming personal schedule.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Welcome header. An "Action Required" section heavily prioritizing incomplete tasks (e.g., "Action Required: Sign Adult Player Waiver for upcoming game").
- **Main content:** My Upcoming Games: A carousel or list of the next 3 games with RSVP toggles (Going, Not Going, Undecided). Team Hub: Quick links to the Roster, Announcements, and Team Invoices.
- **Components:** Alert Banner, RSVP Toggle, Matchup Card, Quick Link Grid.
- **Variants and states:** Guardian view (showing tasks for multiple minors), Coach view (showing team-level alerts).
- **Responsive and accessibility:** Navigation switches to bottom tabs on the native mobile shell.
- **Mockup filenames:** `TEAM-01-coach-dashboard-desktop.png`, `TEAM-01-player-dashboard-mobile.png`.

#### TEAM-02 - Team application wizard

- **Route and roles:** `/portal/apply` | Coach/Manager.
- **Primary goal and action:** Complete the multi-step team application process without losing progress.
- **Layout and target viewport:** Short wizard layout | Desktop (1440).
- **Above the fold:** A persistent, horizontal or left-rail stepper showing progress: "1. Team Info → 2. Church Certification → 3. Roster → 4. Waivers → 5. Fee → 6. Review".
- **Main content:** The active step's form fields. For Step 1, this includes Team Name, Requested Division, and basic Coach contact info.
- **Sticky and scrollable regions:** Sticky bottom action bar with "Save & Continue" and "Back" buttons.
- **Components:** Stepper, Form Inputs, Sticky Action Bar.
- **Variants and states:** In-progress (saved draft).
- **Responsive and accessibility:** Form uses one column on mobile, reducing cognitive load. "Save & Continue" prevents data loss if the user exits.
- **Mockup filenames:** `TEAM-02-team-application-wizard-desktop.png`.

#### TEAM-03 - Church representative certification

- **Route and roles:** `/portal/apply/certification` | Coach/Manager.
- **Primary goal and action:** Collect authorization details from the sponsoring church.
- **Layout and target viewport:** Short wizard layout | Desktop (1440).
- **Above the fold:** Continuation of the TEAM-02 stepper (Step 2 active).
- **Main content:** Form inputs for Church Name, Pastor/Representative Name, and Contact Email/Phone. A clear informational block explains that an email will be sent to the representative for digital sign-off.
- **Components:** Stepper, Form Inputs, Info Alert Box.
- **Responsive and accessibility:** Clear validation messages if required fields are skipped.
- **Mockup filenames:** `TEAM-03-church-certification-desktop.png`.

#### TEAM-04 - Application review and status

- **Route and roles:** `/portal/apply/status` | Coach/Manager.
- **Primary goal and action:** Review submitted application details and track league approval status.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Large Status Banner (e.g., "Status: Pending Church Certification" with `color.status.workflowPending` styling). A progress timeline mapping the application lifecycle.
- **Main content:** Read-only summary cards displaying Team Information, Church Representative, and Initial Roster count.
- **Sticky and scrollable regions:** Standard page scroll.
- **Components:** Status Banner, Progress Timeline, Read-only Summary Card.
- **Variants and states:** Approved (Emerald badge), Rejected (Destructive badge with reason required text), Waitlisted.
- **Responsive and accessibility:** Clear distinction between actionable items (like resending a certification email) and read-only text.
- **Mockup filenames:** `TEAM-04-application-status-desktop.png`.

#### TEAM-05 - Roster and Eligibility Command Center

- **Layout:** Admin Workbench.
- **Target viewport:** Desktop (1440).
- **Primary action:** Identify missing waivers or eligibility blocks to clear players for game day.
- **Above the fold:** Compact top bar with Team and Season context. A progress summary strip showing 3 to 4 KPI tiles (e.g., "12/15 Eligible", "3 Action Required").
- **Main content:** Dense data table displaying the team roster. Columns include Player, Jersey, Role, Waiver 1, Waiver 2, and Overall Status. Badges rely on both color and text (e.g., an Amber badge reading "Pending Sync", a Red badge reading "Missing").
- **Components:** KPI Tiles, Data Table (Sticky Header), Eligibility Badge, Contextual Action Menu.
- **Mockup filename:** `TEAM-05-roster-eligibility-desktop.png`

#### TEAM-06 - Add, invite, duplicate-check, or review roster member

- **Route and roles:** `/portal/team/roster/add` | Coach/Manager.
- **Primary goal and action:** Add players to the roster while preventing duplicate database profiles.
- **Layout and target viewport:** Short wizard/overlay | Desktop (1440) / Mobile (393).
- **Above the fold:** Clean input field for "Player Email or Phone Number".
- **Main content:** **Step 1:** Input contact info to trigger the duplicate check. **Step 2:** System returns a match (showing obfuscated details like "J. Doe -j***@email.com") or confirms it's a new player. **Step 3:** Form to add Name, Jersey Number, and Role (Player/Substitute).
- **Components:** Search Input, Loading Skeleton (for db check), Player Match Card, Form Inputs.
- **Responsive and accessibility:** The duplicate check process must be completely screen-reader accessible, announcing "One matching player found".
- **Mockup filenames:** `TEAM-06-roster-invite-desktop.png`.

#### TEAM-07 - Roster-member eligibility detail and source-rule explanation

- **Route and roles:** `/portal/team/roster/{id}/eligibility` | Coach/Manager.
- **Primary goal and action:** Provide transparent, human-readable explanations for why a player is ineligible.
- **Layout and target viewport:** Drawer/Bottom Sheet overlaying TEAM-05 | Desktop (1440) / Mobile (393).
- **Above the fold:** Player Name, Jersey, and a prominent Red `color.status.danger` badge reading "Ineligible".
- **Main content:** A list of rules checked by the system. Passing rules show a green checkmark. Failing rules (e.g., "Age Requirement", "Missing Parks Waiver") show a warning icon and a clear text explanation citing the source rule (e.g., "Player must be 18+ by Season Start Date").
- **Components:** Overlay Drawer, Status Badge, Rule Validation List, Alert Box.
- **Responsive and accessibility:** Opens as a 480px right-side drawer on desktop and a full-height bottom sheet on mobile.
- **Mockup filenames:** `TEAM-07-eligibility-detail-desktop.png`.

#### TEAM-08 - Roster change request

- **Route and roles:** `/portal/team/roster/change` | Coach/Manager.
- **Primary goal and action:** Submit a formal request to the league to add/drop players after the roster lock date.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A warning banner indicating that changes require league approval.
- **Main content:** A form requesting the Player to Add/Drop, and a required text area for "Reason for Request" (e.g., injury replacement, relocation).
- **Sticky and scrollable regions:** Sticky "Submit Request" button.
- **Components:** Form Inputs, Text Area, Warning Banner, Button Primary.
- **Mockup filenames:** `TEAM-08-roster-change-request-desktop.png`.

#### TEAM-09 - Waiver and document completion center

- **Route and roles:** `/portal/team/documents` | Player, Guardian, Coach.
- **Primary goal and action:** Track and execute required legal agreements.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Clear instructions: "The following documents must be signed before participating.".
- **Main content:** A clean list of required documents (e.g., "Parks & Rec Liability Release", "League Code of Conduct"). Each item features a status indicator (Missing, Pending, Completed) and an actionable "Review & Sign" button.
- **Components:** Document List Item, Status Badge, Button Primary.
- **Responsive and accessibility:** Large touch targets. Clear visual hierarchy prioritizing unsigned documents.
- **Mockup filenames:** `TEAM-09-document-center-desktop.png`.

#### TEAM-10 - Electronic-record consent and paper alternative

- **Route and roles:** `/portal/team/documents/consent` | Player, Guardian.
- **Primary goal and action:** Capture explicit legal consent to use electronic signatures.
- **Layout and target viewport:** Native task screen / Step 1 of Workflow | Desktop (1440) / Mobile (393).
- **Above the fold:** "Consent to Electronic Signatures" title.
- **Main content:** Immutable legal text outlining ESIGN act compliance. Two distinct, equal-weight buttons: "I Consent to Electronic Signatures" and "I Prefer a Paper Waiver".
- **Components:** Rich Text Block, Button Primary, Button Secondary.
- **Variants and states:** Selecting the paper alternative triggers a modal with download links and offline submission instructions.
- **Mockup filenames:** `TEAM-10-electronic-consent-desktop.png`.

#### TEAM-11 - Adult waiver document review and electronic signature

- **Route and roles:** `/portal/team/documents/sign` | Player.
- **Primary goal and action:** Review the full, unchanged legal document and execute a signature.
- **Layout and target viewport:** Split view (Desktop) / Full-screen sequential (Mobile).
- **Above the fold:** "Approved Waiver Body — Unchanged" placeholder.
- **Main content:** Desktop: Left pane contains the complete, scrollable legal document. Right pane contains the signature capture area (Typed legal name input, explicit intent checkbox, and sign action). Mobile: Sequential steps. **Step 1:** Read full document. **Step 2:** Acknowledge and sign.
- **Sticky and scrollable regions:** The waiver text MUST be fully scrollable and zoomable without truncation. The sign action remains sticky or in an adjacent pane.
- **Components:** Document Viewer, Form Input (Typed Name), Checkbox, Button Primary.
- **Mockup filenames:** `TEAM-11-adult-waiver-sign-desktop.png`, `TEAM-11-adult-waiver-sign-mobile.png`.

#### TEAM-12 - Guardian-managed participant and minor waiver workflow

- **Route and roles:** `/portal/team/documents/minor-sign` | Guardian.
- **Primary goal and action:** Establish the legal relationship and sign on behalf of a minor.
- **Layout and target viewport:** Native task screen | Desktop (1440) / Mobile (393).
- **Above the fold:** Relationship declaration (e.g., "I am the parent/legal guardian of [Minor Name]").
- **Main content:** Similar to TEAM-11, but the signature block explicitly states the signature is executed on behalf of the named minor.
- **Components:** Document Viewer, Relationship Dropdown, Form Input, Checkbox.
- **Mockup filenames:** `TEAM-12-minor-waiver-workflow-desktop.png`.

#### TEAM-13 - Waiver receipt, downloadable signed copy, and certificate

- **Route and roles:** `/portal/team/documents/receipt` | Player, Guardian.
- **Primary goal and action:** Provide proof of execution and allow the user to download their records.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Large `color.status.success` checkmark and "Waiver Successfully Completed".
- **Main content:** Details of the transaction (Timestamp, IP Address reference, Signer Name). A prominent "Download Signed PDF" button.
- **Components:** Success Graphic, KPI Tile (for transaction details), Button Primary.
- **Mockup filenames:** `TEAM-13-waiver-receipt-desktop.png`.

#### TEAM-14 - Household and managed-person profiles

- **Route and roles:** `/portal/account/household` | Guardian, Player.
- **Primary goal and action:** Manage dependent profiles (minors) and update shared household contact information.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "My Household" header.
- **Main content:** A list of managed profiles. Clicking a profile opens their details (Name, DOB, associated teams, medical/emergency contacts if strictly required by the league). "Add Family Member" button.
- **Components:** Profile List Item, Avatar, Form Inputs.
- **Responsive and accessibility:** Uses clear list items that reflow easily to single columns on mobile.
- **Mockup filenames:** `TEAM-14-household-profiles-desktop.png`.

#### TEAM-15 - Team availability, conflicts, and RSVP

- **Route and roles:** `/portal/team/availability` | Coach, Player, Guardian.
- **Primary goal and action:** Allow players to signal attendance and help coaches anticipate roster shortages.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "My Availability" header. A compact summary showing the next immediate game with a large, touch-friendly segmented control: "Going", "Not Going", "Undecided".
- **Main content:** A list of upcoming scheduled games. Coaches see an aggregated view (e.g., "10 Going, 2 Out, 3 Undecided") on each game card, which expands to show the specific player list.
- **Components:** Segmented Control, Matchup Card, Accordion, Avatar Stack.
- **Responsive and accessibility:** RSVP toggles use minimum 48dp heights on mobile to ensure fat-finger error prevention. Screen readers clearly announce the current selection state.
- **Mockup filenames:** `TEAM-15-availability-player-mobile.png`, `TEAM-15-availability-coach-desktop.png`.

#### TEAM-16 - Coach lineup builder with eligibility, age, coed, and special-runner validation

- **Route and roles:** `/portal/team/lineup` | Coach/Manager.
- **Primary goal and action:** Create a valid batting order and fielding lineup prior to game time.
- **Layout and target viewport:** Split-pane workbench | Desktop (1440) / Mobile (393).
- **Above the fold:** A sticky validation banner that updates in real-time (e.g., "Valid Lineup", or an Amber `color.status.warning` reading "Missing 1 Female Player for Coed Requirement").
- **Main content:** **Left Pane / Top (Mobile):** The active 1-through-10 (or 12) Batting Order. Uses drag-and-drop handles. **Right Pane / Bottom (Mobile):** The available roster pool. Ineligible players (due to missing waivers or age) are visually dimmed and disabled from selection.
- **Sticky and scrollable regions:** The validation banner and "Save Lineup" button remain sticky. The roster pool scrolls independently.
- **Components:** Draggable List Item, Validation Banner, Status Badge, Sticky Action Bar.
- **Variants and states:** Validation Error (prevents saving as "Official", limits to "Draft").
- **Mockup filenames:** `TEAM-16-lineup-builder-desktop.png`, `TEAM-16-lineup-builder-mobile.png`.

#### TEAM-17 - Personalized team schedule, game detail, and directions

- **Route and roles:** `/portal/team/schedule` | Player, Guardian, Coach.
- **Primary goal and action:** View only the games relevant to the user's specific team.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Season filter (defaults to Current). A high-contrast "Next Game" hero card featuring the date, time, opponent, and a one-tap link to map directions.
- **Main content:** A chronological list of games. Past games display the final score and a link to the box score. Future games display RSVP status.
- **Components:** Matchup Card, Icon Button (Directions), Status Badge.
- **Mockup filenames:** `TEAM-17-team-schedule-desktop.png`.

#### TEAM-18 - Team alerts and announcements

- **Route and roles:** `/portal/team/announcements` | Player, Guardian, Coach.
- **Primary goal and action:** Read internal team communications and league broadcasts.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Feed view of recent messages. Urgent alerts (e.g., "Field Change for Tonight") are pinned to the top with a distinct border (`color.status.warning`).
- **Main content:** Chronological message cards. Coaches have a floating action button (FAB) to "Compose New Message" targeting their roster.
- **Components:** Message Card, Floating Action Button, Badge.
- **Mockup filenames:** `TEAM-18-team-alerts-mobile.png`.

#### TEAM-19 - Team fees, invoice, payment status, credit or refund, and receipt

- **Route and roles:** `/portal/team/finance` | Coach/Manager.
- **Primary goal and action:** Review financial obligations, view invoices, and track payments.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A clear "Balance Due" KPI tile in the center of the viewport. If the balance is $0.00, it renders in `color.status.success` (Emerald).
- **Main content:** A data table listing all ledger items: Invoices, Payments applied, Credits, and Refunds. Clicking an invoice opens a detailed view showing line items (e.g., "Fall Season Registration", "Non-Resident Fee").
- **Components:** KPI Tile, Data Table, Button Primary (Pay Now).
- **Variants and states:** Partially Paid, Overdue (Destructive text), Refund Processed.
- **Mockup filenames:** `TEAM-19-team-finance-desktop.png`.

#### TEAM-20 - Team downloads and generated packet status

- **Route and roles:** `/portal/team/downloads` | Coach/Manager.
- **Primary goal and action:** Download the officially approved, offline-ready team packet for game day (rosters, emergency contacts, local rules).
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A large status card indicating if the Team Packet is "Generated & Ready" or "Blocked (Missing Waivers)".
- **Main content:** A list of downloadable PDF resources specifically tailored to the team. A prominent "Download Official Roster PDF" button.
- **Components:** Status Card, Resource List Item, Button Primary.
- **Responsive and accessibility:** Clear system warnings if the coach attempts to generate a packet while roster members are still ineligible.
- **Mockup filenames:** `TEAM-20-team-downloads-desktop.png`.

#### TEAM-21 - Personal official statistics and game log

- **Route and roles:** `/portal/account/stats` | Player.
- **Primary goal and action:** View personal performance metrics across all seasons played.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Player Profile header with aggregated career stats (AVG, HR, RBI) displayed in compact KPI tiles.
- **Main content:** Two tabs: "Season Stats" (table grouped by year) and "Game Log" (chronological breakdown of individual game performances).
- **Components:** Profile Header, KPI Tiles, Tabs, Data Table.
- **Mockup filenames:** `TEAM-21-personal-stats-desktop.png`.

### 8.3 Web administration portal

#### ADM-01 - League Command Center Dashboard

- **Layout:** Admin Workbench.
- **Target viewport:** Desktop (1440).
- **Primary action:** Navigate immediately to urgent operational exceptions.
- **Above the fold:** Welcome header for the League Officer. An "Action Required" strip alerting the user to unapproved AI media recaps, pending team applications, or severe weather monitoring.
- **Main content:** A grid of 4-6 KPI tiles tracking active season health (Games Played, Active Teams, Revenue YTD, Open Incidents). Below this, a two-column layout featuring an "Upcoming Schedule" widget and a "Recent Activity" audit log.
- **Components:** Admin Sidebar, Exception Strip, KPI Tile, Audit Log List.
- **Mockup filename:** `ADM-01-league-command-center-desktop.png`

#### ADM-02 - Season operations and game-night command center

- **Route and roles:** `/admin/game-night` | League Admin.
- **Primary goal and action:** Provide a real-time, high-level overview of all active games, umpire check-ins, and synchronization health during game night.
- **Layout and target viewport:** 100dvh Admin Workbench | Desktop (1440) / Tablet Landscape (1194).
- **Above the fold:** Global sync health indicator. A grid of compact "Game Cards" for the current night.
- **Main content:** Each Game Card displays the field, teams, assigned umpire (and check-in status), and real-time score. The card prominently displays the device sync status (e.g., "Synced 1m ago", or a warning "Pending Sync - Offline for 15m").
- **Sticky and scrollable regions:** The screen is designed to fit entirely within one viewport on desktop to act as a monitoring dashboard without scrolling.
- **Components:** Live Game Card, Umpire Avatar, Sync Status Badge.
- **Mockup filenames:** `ADM-02-gamenight-command-desktop.png`.

#### ADM-03 - Season list and new-season or clone-season wizard

- **Route and roles:** `/admin/seasons` | League Admin.
- **Primary goal and action:** Manage the lifecycle of league seasons and rapidly spin up new ones by copying past configurations.
- **Layout and target viewport:** Admin Workbench + Modal Wizard | Desktop (1440).
- **Above the fold:** Page title "Seasons" and a primary "Create Season" button.
- **Main content:** A data table listing all historical and upcoming seasons (Name, Status, Dates, Teams). Clicking "Create Season" opens a modal wizard. **Wizard Content:** Step 1 allows the user to start blank or "Clone from Existing". Cloning pre-fills configuration checkboxes for Teams, Rules, Fees, and Field Allocations.
- **Components:** Data Table, Modal Dialog, Stepper, Checkbox List.
- **Mockup filenames:** `ADM-03-season-list-desktop.png`, `ADM-03-clone-season-modal.png`.

#### ADM-04 - Organization, league, division, season, terminology, dates, and branding configuration

- **Route and roles:** `/admin/config/organization` | League Admin.
- **Primary goal and action:** Customize the platform tenant to match the specific league's identity and operational dates.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabbed navigation to split complex settings into manageable chunks: "Branding", "Terminology", "Divisions", "Key Dates".
- **Main content:** **Branding Tab:** File upload inputs for League Logo and fields for primary brand colors. **Terminology Tab:** Inputs to override default labels (e.g., changing "Coach" to "Manager", or "Player" to "Participant").
- **Sticky and scrollable regions:** A sticky bottom action bar contains "Save Changes" and "Discard".
- **Components:** Tabs, File Upload, Text Inputs, Color Picker Placeholder, Sticky Action Bar.
- **Mockup filenames:** `ADM-04-organization-config-desktop.png`.

#### ADM-05 - Members, roles, permission bundles, and effective assignments

- **Route and roles:** `/admin/members/roles` | League Admin.
- **Primary goal and action:** Manage administrative access, assign roles, and audit permissions.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "Directory & Roles" header. Search bar and filter dropdowns (e.g., **Filter by Role:** Umpire, Scorekeeper, Board Member).
- **Main content:** A data table displaying User Name, Email, Primary Role, and Status (Active/Revoked). Clicking a user opens a right-side drawer detailing their "Effective Assignments" (e.g., showing that a user has "Scorekeeper" permissions granted via a specific team assignment).
- **Components:** Search Input, Filter Select, Data Table, Drawer, Badge.
- **Responsive and accessibility:** Drawer implementation avoids navigating away from the full list, reducing cognitive load.
- **Mockup filenames:** `ADM-05-members-roles-desktop.png`.

#### ADM-06 - Governance, Board membership, elected offices, terms, and decision history

- **Route and roles:** `/admin/governance` | League Admin, Board Member.
- **Primary goal and action:** Maintain organizational transparency regarding leadership and official league decisions.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Two primary tabs: "Board of Directors" and "Decision History".
- **Main content:** **Board Tab:** A list or grid of active board members, their titles (e.g., President, Treasurer), and their term limits (Start/End Dates). **Decision History Tab:** A chronological log of official board votes and rules changes, requiring a human approver's name attached to each entry.
- **Components:** Tabs, Avatar List, Timeline/Log List.
- **Mockup filenames:** `ADM-06-governance-desktop.png`.

#### ADM-07 - Versioned rules, forms, fees, stat definitions, tiebreakers, and templates

- **Route and roles:** `/admin/config/versions` | League Admin.
- **Primary goal and action:** Manage the immutable records of league configurations across different seasons.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A categorized list of configuration items (e.g., "Fall 2026 Registration Fee", "Tiebreaker Logic").
- **Main content:** Each item row displays the current active version (e.g., "v3.1") and a "View History" button.
- **Components:** Categorized List, Version Badge (`color.status.info`), Button Secondary.
- **Mockup filenames:** `ADM-07-versioned-config-desktop.png`.

#### ADM-08 - Rule or configuration version detail and comparison

- **Route and roles:** `/admin/config/compare/{id}` | League Admin.
- **Primary goal and action:** Visually compare proposed changes against the currently active rule or configuration.
- **Layout and target viewport:** Split-view Admin Workbench | Desktop (1440).
- **Above the fold:** "Compare Versions" sticky header with "Approve Changes" or "Reject" buttons.
- **Main content:** **Left Pane:** The currently published version (read-only). **Right Pane:** The drafted or proposed version. Text differences are highlighted (additions in subtle green background, deletions in strikethrough red).
- **Components:** Split Pane, Sticky Action Bar, Diff Text Block, Button Primary.
- **Mockup filenames:** `ADM-08-rule-comparison-desktop.png`.

#### ADM-09 - Waiver and form template manager with checksum, merge fields, and rendered preview

- **Route and roles:** `/admin/config/templates` | League Admin.
- **Primary goal and action:** Create and manage legal waiver templates without risking truncation or alteration of the core legal text.
- **Layout and target viewport:** Admin Workbench with Preview Drawer | Desktop (1440).
- **Above the fold:** Text editor toolbar above a large text area for the waiver body.
- **Main content:** The editor allows insertion of merge fields (e.g., `{{Player_Name}}`, `{{League_Year}}`). A side pane or drawer provides a live "Rendered Preview" showing exactly how the document will appear to the signer. A checksum hash is visible at the bottom to guarantee document immutability once published.
- **Components:** Rich Text Area, Merge Field Tags, Drawer (Preview), Hash String Display.
- **Mockup filenames:** `ADM-09-waiver-template-manager-desktop.png`.

#### ADM-10 - Team-application review queue

- **Route and roles:** `/admin/applications/queue` | League Admin.
- **Primary goal and action:** Triage incoming team applications for the upcoming season.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** KPI tiles showing "Pending Review", "Approved", and "Waitlisted".
- **Main content:** A data table acting as the queue. Columns include Team Name, Coach, Division Requested, Submission Date, and Status. The table is sorted by oldest submission first.
- **Components:** KPI Tile, Data Table (Sticky Header), Status Badge.
- **Mockup filenames:** `ADM-10-application-queue-desktop.png`.

#### ADM-11 - Team-application review detail

- **Route and roles:** `/admin/applications/review/{id}` | League Admin.
- **Primary goal and action:** Thoroughly review a specific team application and record a binding decision.
- **Layout and target viewport:** Split-pane Admin Workbench | Desktop (1440).
- **Above the fold:** Team Name header and a sticky decision bar ("Approve", "Waitlist", "Reject").
- **Main content:** **Left Pane:** The submitted application data (Church Certification, Roster Size, Requested Division). **Right Pane:** Admin notes and audit history. If the admin selects "Reject" or "Waitlist", a reason-required text area dynamically appears.
- **Components:** Split Pane, Sticky Action Bar, Text Area (Reason Required), Read-only Summary Cards.
- **Mockup filenames:** `ADM-11-application-review-desktop.png`.

#### ADM-12 - Affiliated churches, organizations, and authorized representatives

- **Route and roles:** `/admin/organizations` | League Admin.
- **Primary goal and action:** Manage the directory of sponsoring churches and their legally authorized signers.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "Sponsoring Organizations" header and "Add Organization" button.
- **Main content:** A list or grid of churches. Expanding a church row reveals their designated Authorized Representatives, their contact info, and their certification status.
- **Components:** Accordion Row, Avatar, Button Secondary.
- **Mockup filenames:** `ADM-12-affiliated-churches-desktop.png`.

#### ADM-13 - People, households, guardian relationships, and duplicate resolver

- **Route and roles:** `/admin/people` | League Admin.
- **Primary goal and action:** Maintain a clean master database of all participants and actively resolve duplicate accounts.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A prominent warning banner if potential duplicate profiles are detected by the system (e.g., "System Warning: 4 Potential Duplicates Found").
- **Main content:** The "Duplicate Resolver" workflow is a specialized modal or dedicated view. It presents a side-by-side comparison of two conflicting records (e.g., "John Smith" vs "J. Smith" at the same address) and provides a "Merge Records" primary action.
- **Components:** Warning Banner, Data Table, Side-by-Side Comparison Card, Button Primary (Merge).
- **Mockup filenames:** `ADM-13-duplicate-resolver-desktop.png`.

#### ADM-14 - League-wide roster, eligibility, and waiver-completion dashboard

- **Route and roles:** `/admin/eligibility` | League Admin.
- **Primary goal and action:** Monitor and enforce player eligibility rules across the entire league.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** High-level KPI tiles showing league-wide completion rates (e.g., "85% Waivers Signed", "42 Players Blocked"). Global filters for "Missing Waivers" or "Age Verification Required".
- **Main content:** A massive data grid capable of virtualization for long data sets. Columns show Player Name, Team, and specific columns for each required compliance check.
- **Components:** KPI Tile, Complex Filter Bar, Virtualized Data Grid, Eligibility Badge.
- **Mockup filenames:** `ADM-14-league-eligibility-dashboard-desktop.png`.

#### ADM-15 - Administrative team-roster detail

- **Route and roles:** `/admin/teams/{id}/roster` | League Admin.
- **Primary goal and action:** View and manage a specific team's roster with full administrative override capabilities.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Team Header with contextual details (Season, Division, Coach). A summary row indicating total roster size and eligibility health (e.g., "14 Active, 2 Blocked").
- **Main content:** A data table displaying the team's players, their jersey numbers, roles, and granular eligibility statuses. Unlike the coach view (TEAM-05), admins have an action menu allowing them to "Edit Player Details", "Move to Different Team", or "Initiate Eligibility Override".
- **Components:** Data Table (Sticky Header), Eligibility Badge, Contextual Action Menu.
- **Mockup filenames:** `ADM-15-admin-team-roster-desktop.png`.

#### ADM-16 - Roster-change request queue and decision

- **Route and roles:** `/admin/rosters/requests` | League Admin.
- **Primary goal and action:** Review and approve or reject roster changes requested by coaches after the roster lock date.
- **Layout and target viewport:** Split-pane Admin Workbench | Desktop (1440).
- **Above the fold:** Sticky queue header with filters for "Pending", "Approved", and "Rejected".
- **Main content:** **Left Pane:** A scrollable list of pending requests (e.g., "Add: J. Smith to Team A"). **Right Pane:** Details of the selected request, including the coach's submitted reason (from TEAM-08). A sticky action bar provides "Approve" and "Reject" buttons.
- **Variants and states:** Rejecting a request triggers a required text area for the admin to provide a reason back to the coach.
- **Components:** Split Pane, List Item, Sticky Action Bar, Text Area (Reason Required).
- **Mockup filenames:** `ADM-16-roster-change-queue-desktop.png`.

#### ADM-17 - Eligibility evaluation and reason-required override

- **Route and roles:** `/admin/eligibility/override/{player_id}` | League Admin.
- **Primary goal and action:** Manually override an automated eligibility block and maintain an audit trail for the decision.
- **Layout and target viewport:** Modal Dialog or Drawer | Desktop (1440).
- **Above the fold:** Player Name and the specific failing rule (e.g., "Age Requirement: Under 18").
- **Main content:** A prominent warning explaining the implications of an override. A required text area labeled "Reason for Override" and a required checkbox stating "I acknowledge this creates a permanent audit record.".
- **Sticky and scrollable regions:** "Confirm Override" button remains disabled until the reason and acknowledgment are completed.
- **Components:** Drawer/Modal, Warning Banner, Form Inputs, Checkbox, Button Destructive/Warning.
- **Mockup filenames:** `ADM-17-eligibility-override-desktop.png`.

#### ADM-18 - Waiver-completion matrix

- **Route and roles:** `/admin/waivers/matrix` | League Admin.
- **Primary goal and action:** View a high-density, cross-league matrix of waiver completion status.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Complex filter bar allowing filtering by Season, Division, Team, or specific Waiver Type.
- **Main content:** A dense grid where the Y-axis is Players and the X-axis represents required documents. Cells use visual icons (Green Check, Red X, Amber Clock) to denote Signed, Missing, and Pending statuses. The table features frozen identity columns (Player Name, Team) on the left to allow horizontal scrolling through multiple document columns without losing context.
- **Components:** Dense Data Grid, Frozen Identity Columns, Status Icons.
- **Mockup filenames:** `ADM-18-waiver-matrix-desktop.png`.

#### ADM-19 - Restricted signed-evidence and legal-hold detail

- **Route and roles:** `/admin/waivers/evidence/{id}` | League Admin (Restricted Permission).
- **Primary goal and action:** Securely review the cryptographic and metadata evidence of a signed waiver, or place it under legal hold.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A prominent badge indicating the document's legal status (e.g., "Signed & Valid" or "LEGAL HOLD" in high-contrast destructive styling).
- **Main content:** The rendered PDF of the signed waiver. A sidebar or split pane displays the unalterable metadata: Signer IP Address, Exact Timestamp, Browser User Agent, and the Document Checksum. An action button allows authorized users to "Initiate Legal Hold", freezing the record from any automated deletion.
- **Components:** Document Viewer, KPI Tiles (for metadata), Badge, Button Destructive.
- **Mockup filenames:** `ADM-19-signed-evidence-desktop.png`.

#### ADM-20 - Paper-waiver recording workflow

- **Route and roles:** `/admin/waivers/paper` | League Admin.
- **Primary goal and action:** Digitally record the receipt of a physical paper waiver, maintaining strict separation from electronic signatures.
- **Layout and target viewport:** Admin Workbench (Form) | Desktop (1440).
- **Above the fold:** Warning text: "This workflow is strictly for recording physical paper waivers. Do not use this to bypass electronic signature requirements.".
- **Main content:** A searchable dropdown to select the Player. Fields to input the "Date Signed on Paper" and "Admin Recording Receipt". An optional file upload control to attach a scanned PDF of the physical document.
- **Components:** Alert Banner, Searchable Select, Date Picker, File Upload, Button Primary.
- **Mockup filenames:** `ADM-20-paper-waiver-workflow-desktop.png`.

#### ADM-21 - Imports, validation results, exports, and team-packet generation

- **Route and roles:** `/admin/data/hub` | League Admin.
- **Primary goal and action:** Manage bulk data operations and generate offline game-day packets.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Four distinct action tiles: "Import Data", "Export Data", "View Validation Logs", and "Generate Team Packets".
- **Main content:** A chronological log of recent data jobs showing the status (e.g., "Team Packets Gen - Processing", "Roster Import - Failed"). Clicking a failed job opens a drawer detailing the specific CSV row errors.
- **Components:** KPI Action Tiles, Job Status Table, Drawer, Error Badge.
- **Mockup filenames:** `ADM-21-data-operations-hub-desktop.png`.

#### ADM-22 - Finance dashboard

- **Route and roles:** `/admin/finance` | Finance Officer / League Admin.
- **Primary goal and action:** Provide a top-level view of the league's financial health and outstanding receivables.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** High-visibility KPI tiles: "Total Revenue YTD", "Outstanding Receivables", "Committed Costs", and "Current Balance".
- **Main content:** A chart area (bar or line graph) tracking revenue vs. expenses over the season. Below the charts, a "Needs Attention" list flags teams with overdue balances or pending refund requests.
- **Components:** KPI Tiles, Data Visualization (Chart), Alert List.
- **Mockup filenames:** `ADM-22-finance-dashboard-desktop.png`.

#### ADM-23 - Budget scenario builder and 7-to-10-team break-even comparison

- **Route and roles:** `/admin/finance/scenarios` | Finance Officer.
- **Primary goal and action:** Allow operators to model fee structures against variable team counts to ensure league solvency.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Scenario title (e.g., "Draft: 2027 Spring Season") and global inputs for "Projected Cost per Game" and "Number of Weeks".
- **Main content:** A comparative matrix showing financial outcomes at 7, 8, 9, and 10 teams. Rows include Fixed Costs (Insurance, Field Rentals), Variable Costs (Umpires, Baseballs), and Revenue (Team Fees). The "Net Balance" row uses semantic colors (Destructive for deficit, Success for surplus).
- **Components:** Form Inputs, Matrix Data Table, Semantic Color Text.
- **Mockup filenames:** `ADM-23-budget-scenario-desktop.png`.

#### ADM-24 - Expenses, vendors, committed costs, and actual ledger

- **Route and roles:** `/admin/finance/ledger` | Finance Officer.
- **Primary goal and action:** Track actual outflows, manage vendor relationships (e.g., umpire associations, equipment suppliers), and view the comprehensive ledger.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabs separating "Ledger", "Expenses", and "Vendors".
- **Main content:** **Ledger Tab:** A standard double-entry style data table listing Date, Description, Vendor/Team, Category, Inflow, Outflow, and Running Balance.
- **Components:** Tabs, Data Table, Filter Select.
- **Mockup filenames:** `ADM-24-ledger-desktop.png`.

#### ADM-25 - Invoices, partial payments, credits, refunds, receipts, and reconciliation

- **Route and roles:** `/admin/finance/invoice/{id}` | Finance Officer / League Admin.
- **Primary goal and action:** Manage an individual team invoice, record manual payments (like physical checks), and issue credits or refunds.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Invoice Header (e.g., "Invoice #INV-1042 - Team Alpha") and a sticky summary bar displaying "Total Billed", "Total Paid", and a color-coded "Balance Due".
- **Main content:** **Line Items Table:** Itemized breakdown of fees. **Transaction Ledger:** List of all payments, credits, or refunds applied to this specific invoice. **Action Panel:** Forms to "Record Manual Payment" or "Apply Credit/Refund".
- **Components:** Sticky Summary Bar, Data Table, Form Inputs, Button Group.
- **Mockup filenames:** `ADM-25-invoice-reconciliation-desktop.png`.

#### ADM-26 - Venues and field management

- **Route and roles:** `/admin/venues` | League Admin.
- **Primary goal and action:** Define the physical locations where games are played and outline their specific field assets.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "Venues & Fields" header with a primary "Add Venue" button.
- **Main content:** An accordion-style list. The top-level row represents the venue (e.g., "Meade County Parks Complex"). Expanding it reveals a nested data table of individual fields (e.g., "Field 1", "Field 2") noting attributes like lights availability, fence distance, and active status.
- **Components:** Accordion Row, Nested Data Table, Status Badge.
- **Mockup filenames:** `ADM-26-venues-management-desktop.png`.

#### ADM-27 - Date-specific availability, slots, bulk patterns, closures, and blackouts

- **Route and roles:** `/admin/venues/availability` | League Admin.
- **Primary goal and action:** Define precisely when fields are available for scheduling and block off unavailable dates.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Date Range Picker and a global "Add Blackout" action button.
- **Main content:** A calendar matrix or slot-grid view. Time slots (e.g., 6:00 PM, 7:30 PM, 9:00 PM) act as the Y-axis and Fields as the X-axis. Admins can click and drag to paint slots as "Available" (Green) or "Blackout" (Charcoal). A side panel allows setting bulk recurring patterns (e.g., "Every Tuesday in May").
- **Components:** Calendar Matrix, Drag-to-Select Grid, Date Range Picker, Side Panel.
- **Mockup filenames:** `ADM-27-field-availability-desktop.png`.

#### ADM-28 - Schedule rules, hard constraints, and weighted preferences

- **Route and roles:** `/admin/schedule/rules` | League Admin.
- **Primary goal and action:** Configure the logic that the schedule-generation algorithm will use.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabbed navigation separating "Hard Constraints" (must be obeyed) and "Soft Preferences" (penalized if broken).
- **Main content:** **Hard Constraints Tab:** Strict numeric inputs (e.g., "Max games per team per week: 2", "Required rest days between games: 1"). **Soft Preferences Tab:** Sliders determining the weight/penalty of breaking a preference (e.g., "Avoid scheduling Team A at 9 PM: Weight 80/100").
- **Components:** Tabs, Numeric Input, Slider Control, Sticky Action Bar (Save Rules).
- **Mockup filenames:** `ADM-28-schedule-rules-desktop.png`.

#### ADM-29 - Schedule-run setup

- **Route and roles:** `/admin/schedule/generate` | League Admin.
- **Primary goal and action:** Define the parameters for a new algorithmic schedule generation run.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "New Schedule Run" header and a primary "Generate Candidates" button.
- **Main content:** A focused, single-column form to select the Target Season, Division(s), Date Range, and the Rule Profile (from ADM-28) to apply.
- **Components:** Select Dropdown, Date Range Picker, Button Primary.
- **Mockup filenames:** `ADM-29-schedule-run-setup-desktop.png`.

#### ADM-30 - Candidate comparison, fairness penalties, and understandable infeasibility report

- **Route and roles:** `/admin/schedule/candidates` | League Admin.
- **Primary goal and action:** Compare generated schedule drafts or understand exactly why a schedule cannot be generated.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** KPI summary cards for the top 3 generated candidates (e.g., "Option A: 0 Violations, 95% Fairness").
- **Main content:** **Success State:** A comparison matrix breaking down penalty points and home/away balance across the candidates. **Infeasible State:** A prominent alert box (`color.status.danger`) listing the exact mathematical impossibility in human terms (e.g., "Team B requires 10 games, but only 8 field slots are available under current hard constraints").
- **Components:** KPI Tiles, Comparison Matrix, Alert Box, Button Primary (Select Draft).
- **Mockup filenames:** `ADM-30-schedule-candidate-comparison-desktop.png`.

#### ADM-31 - Visual Schedule Editor

- **Layout:** 100dvh Admin Workbench.
- **Above the fold:** Sticky top toolbar with "Draft Version 3", "Generate", "Validate", and a primary "Publish" button.
- **Main content:** Center grid acting as a bounded internal scroll region. Time rows (Y-axis), Field columns (X-axis). Frozen headers keep the grid readable. Unscheduled game cards sit in a collapsible 240px left rail. A 320px right inspector panel displays hard-constraint warnings for the selected game.
- **Components:** Admin Sidebar, Grid Matrix, Draggable Game Card, Inspector Drawer, Validation Badge.

#### ADM-32 - Schedule publication, old-versus-new revision comparison, recipients, and notification preview

- **Route and roles:** `/admin/schedule/publish` | League Admin.
- **Primary goal and action:** Review modifications, explicitly approve a schedule version for public release, and notify affected parties.
- **Layout and target viewport:** Split-pane Admin Workbench | Desktop (1440).
- **Above the fold:** Sticky action bar reading "Review & Publish Schedule" with "Publish & Notify" button.
- **Main content:** **Left Pane (Diff Viewer):** A list strictly showing what changed since the last published version (e.g., "Game 14: Moved from Field 1 to Field 2", "Game 18: Time changed to 7:30 PM"). **Right Pane (Notification):** A pre-populated, editable announcement composer targeting only the coaches and umpires affected by the specific changes.
- **Components:** Split Pane, Diff List Viewer, Announcement Composer, Sticky Action Bar.
- **Mockup filenames:** `ADM-32-schedule-publish-compare-desktop.png`.

#### ADM-33 - Schedule version history and PDF, ICS, public-web, and spreadsheet exports

- **Route and roles:** `/admin/schedule/versions` | League Admin.
- **Primary goal and action:** Access historical schedule versions and generate printable or portable files.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A horizontal action bar dedicated to exports: "Download PDF", "Export CSV", "Export ICS".
- **Main content:** A chronological timeline or data table of all published versions, showing the publisher's name, the timestamp, and the publication notes.
- **Components:** Button Group (Exports), Timeline/Data Table.
- **Mockup filenames:** `ADM-33-schedule-exports-desktop.png`.

#### ADM-34 - Umpire and scorekeeper directory and profiles

- **Route and roles:** `/admin/officials` | League Admin.
- **Primary goal and action:** Manage the roster of certified game officials.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabs separating "Umpires" and "Scorekeepers".
- **Main content:** A data table displaying Name, Contact Information, Certification Level, and a summary of "Games Worked This Season". An action menu allows admins to edit profiles or block assignments.
- **Components:** Tabs, Data Table, Action Menu, Avatar.
- **Mockup filenames:** `ADM-34-officials-directory-desktop.png`.

#### ADM-35 - Official availability, assignment board, confirmations, replacements, and fees

- **Route and roles:** `/admin/officials/assignments` | League Admin.
- **Primary goal and action:** Assign officials to specific games and track their confirmation status.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Date Range or Week selector filter.
- **Main content:** An "Assignment Board" formatted as a dense grid. Rows represent scheduled games. Columns represent required official roles (Plate Umpire, Base Umpire, Scorekeeper). Cells contain searchable dropdowns to select an official. Once selected, a status badge appears (e.g., "Pending", "Confirmed", "Declined"). The system visibly dims officials who are already assigned to a conflicting time slot.
- **Components:** Dense Assignment Matrix, Searchable Select, Status Badge (`color.status.warning` for pending, `color.status.success` for confirmed).
- **Mockup filenames:** `ADM-35-official-assignment-board-desktop.png`.

#### ADM-36 - Live-game operations and synchronization-health dashboard

- **Route and roles:** `/admin/live/health` | League Admin.
- **Primary goal and action:** Monitor the technical connection status of all active scorekeeping devices and intervene during network outages.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Global health summary prominently displaying "Active Devices", "Synced Devices", and "Offline/Stale Devices" using clear `color.status` indicators.
- **Main content:** A data grid listing active games. Columns focus heavily on technical metrics: Assigned Scorekeeper, Device Type, Last Sync Timestamp, and Writer-Lease Status. Rows representing devices offline for more than 5 minutes pulse with a `color.status.warning` background.
- **Components:** KPI Tiles, Data Grid, Status Badge (`color.status.offline`, `color.status.synchronizing`), Action Menu.
- **Mockup filenames:** `ADM-36-live-operations-desktop.png`.

#### ADM-37 - Administrative game detail, event timeline, line score, box score, scorekeeper submission, and umpire attestation

- **Route and roles:** `/admin/games/{id}/official` | League Admin, Umpire.
- **Primary goal and action:** Review the submitted digital scorebook and lock it in as the official league record.
- **Layout and target viewport:** Split-pane Admin Workbench | Desktop (1440) / Tablet Landscape (1194).
- **Above the fold:** Game header with a prominent badge indicating current status (e.g., "Submitted pending sync", "Attested pending sync", or "Official final").
- **Main content:** **Left Pane:** The complete event timeline and play log (scrollable). **Right Pane:** The line score, box score totals, and the critical "Attestation Block". The Attestation Block requires the Umpire to digitally confirm the score is correct before the "Mark as Official Final" button unlocks.
- **Components:** Split Pane, Event Timeline List, Read-Only Data Table, Attestation Form, Button Primary.
- **Mockup filenames:** `ADM-37-admin-game-detail-desktop.png`.

#### ADM-38 - Writer-lease transfer and lineup-override workflow

- **Route and roles:** `/admin/live/lease-transfer/{id}` | League Admin.
- **Primary goal and action:** Forcefully transfer scoring control from a broken/disconnected device to a new device or administrator without losing data.
- **Layout and target viewport:** Modal Dialog or Drawer | Desktop (1440).
- **Above the fold:** High-contrast warning: "Transferring the Writer Lease will lock out the original device to prevent data conflicts".
- **Main content:** Details of the last known sync state (e.g., "Top 4th, 2 Outs"). A searchable select input to designate the new authorized scorer. A mandatory text area for "Reason for Override".
- **Components:** Warning Banner, KPI Tile (Sync State), Searchable Select, Text Area, Button Warning.
- **Mockup filenames:** `ADM-38-writer-lease-transfer-desktop.png`.

#### ADM-39 - Official game-amendment queue and original-versus-proposed comparison

- **Route and roles:** `/admin/games/amendments` | League Admin.
- **Primary goal and action:** Review and approve post-game statistical corrections requested after a game has been marked Official Final.
- **Layout and target viewport:** Split-view Admin Workbench | Desktop (1440).
- **Above the fold:** "Amendment Queue" header with filters for Pending, Approved, and Rejected requests.
- **Main content:** **Left Pane:** The original Official Final event log and box score. **Right Pane:** The proposed changes highlighted using a Diff Text Block (e.g., changing a Hit to an Error). Sticky decision controls for "Approve Amendment" and "Reject" are positioned at the bottom.
- **Components:** Split Pane, Diff Text Block, Sticky Action Bar.
- **Mockup filenames:** `ADM-39-game-amendment-desktop.png`.

#### ADM-40 - Standings, tiebreaker, stat-formula, regeneration, and public-privacy controls

- **Route and roles:** `/admin/config/standings` | League Admin.
- **Primary goal and action:** Configure how standings are calculated, test tiebreaker scenarios, and trigger manual recalculations.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabbed navigation: "Tiebreaker Logic", "Stat Formulas", "Privacy & Display".
- **Main content:** A drag-and-drop list to rank tiebreaker precedence (e.g., 1. Head-to-Head, 2. Runs Allowed, 3. Run Differential). A prominent "Force Regenerate Standings" button resides in a secondary action panel, featuring a reason-required confirmation modal.
- **Components:** Tabs, Draggable List, Button Warning, Modal Dialog.
- **Mockup filenames:** `ADM-40-standings-config-desktop.png`.

#### ADM-41 - Incident, protest, ejection, discipline, injury, and equipment-inspection records

- **Route and roles:** `/admin/records/incidents` | League Admin.
- **Primary goal and action:** Securely log and track confidential league incidents and disciplinary actions.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** KPI dashboard showing "Open Protests", "Recent Ejections", and "Pending Disciplinary Reviews".
- **Main content:** A dense data table restricted to high-level admins. Columns denote Incident Date, Type, Involved Parties, and Resolution Status. Expanding a row reveals the confidential narrative and attached evidence. This page strictly adheres to privacy constraints and obscures names from lower-level staff if permissions dictate.
- **Components:** KPI Tiles, Data Table, Accordion Row, File Upload.
- **Mockup filenames:** `ADM-41-incident-records-desktop.png`.

#### ADM-42 - Announcement center

- **Route and roles:** `/admin/communications` | League Admin.
- **Primary goal and action:** Serve as the central hub for viewing past broadcasts and launching new league-wide messages.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "Communications Center" header with a prominent "Compose New Announcement" primary button.
- **Main content:** A feed or table of past announcements showing Subject, Sender, Timestamp, and a high-level "Delivery Success" percentage bar.
- **Components:** Button Primary, Data Table, Progress Bar (for delivery success).
- **Mockup filenames:** `ADM-42-announcement-center-desktop.png`.

#### ADM-43 - Announcement composer, recipient query, affected games or fields, canonical message, and channel copy

- **Route and roles:** `/admin/communications/compose` | League Admin.
- **Primary goal and action:** Draft a message, target the right audience dynamically, and adjust copy for different channels.
- **Layout and target viewport:** Resumable Stepper Workbench | Desktop (1440).
- **Above the fold:** Stepper tracking progress: "1. Audience → 2. Message → 3. Channels → 4. Review".
- **Main content:** **Audience Step:** Query builder to target specific groups (e.g., "All Coaches in Division A", or "Teams scheduled at Field 1 today"). **Message Step:** Rich text editor for the canonical email message. **Channels Step:** Separate, smaller text areas to define truncated SMS and Push Notification copy.
- **Components:** Stepper, Query Builder, Rich Text Area, Text Area (Character Limited).
- **Mockup filenames:** `ADM-43-announcement-composer-desktop.png`.

#### ADM-44 - Recipient resolution, consent or suppression exclusions, and email, SMS, push, social, and status previews

- **Route and roles:** `/admin/communications/preview` | League Admin.
- **Primary goal and action:** Verify exact audience numbers, preview formatting, and ensure compliance before hitting send.
- **Layout and target viewport:** Split-pane Admin Workbench (Step 4 of Composer) | Desktop (1440).
- **Above the fold:** A sticky summary block: "Targeting 142 Users. 12 excluded due to opt-outs.".
- **Main content:** **Left Pane:** A scrollable list of resolved recipients, flagging any suppressed users explicitly. **Right Pane:** Visual device mockups previewing exactly how the message looks as an Email, an SMS text bubble, and a native Push Notification.
- **Components:** Split Pane, List Item, Device Frame Previews, Sticky Action Bar (Send).
- **Mockup filenames:** `ADM-44-announcement-preview-desktop.png`.

#### ADM-45 - Delivery results, retries, failures, coach acknowledgements, and escalation

- **Route and roles:** `/admin/communications/report/{id}` | League Admin.
- **Primary goal and action:** Track the successful delivery of a broadcast and escalate if critical users (like coaches) failed to receive it.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Delivery health dashboard showing percentages for Delivered, Bounced, and Opened.
- **Main content:** A data table of all recipients. If an urgent alert required acknowledgement, a specific column displays the acknowledgement status. Admins can select users who failed to receive the message and click an "Escalate to Voice/Manual" button.
- **Components:** KPI Tiles, Data Table, Status Badge, Button Secondary.
- **Mockup filenames:** `ADM-45-delivery-results-desktop.png`.

#### ADM-46 - Weather Advisory and Authorized Decision Console

- **Layout:** Admin Workbench.
- **Target viewport:** Desktop (1440).
- **Primary action:** Record weather delay/cancellation and push authorized notifications.
- **Above the fold:** Advisory warning banner: "Weather information is advisory. Only an authorized person records a delay, postponement, or field closure." Current canonical field status is displayed in a prominent selector.
- **Main content:** Radio controls to switch canonical status (Open, Delayed, Closed). A secondary integrated pane contains the Announcement Composer, pre-filtered to target SMS/Push/Email to coaches and umpires affected by the immediate schedule window.
- **Components:** Radio Group (Status), Alert Banner, Announcement Composer, Button Destructive, Button Primary.
- **Mockup filename:** `ADM-46-weather-decision-desktop.png`, `ADM-46-weather-decision-desktop-annotated.png`

#### ADM-47 - Consent, communication preferences, and suppression administration

- **Route and roles:** `/admin/communications/suppressions` | League Admin.
- **Primary goal and action:** Manage user opt-outs, hard bounces, and ensure compliance with communication laws (e.g., CAN-SPAM, TCPA).
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** KPI tiles showing "Total Suppressed", "Recent Opt-outs", and "Hard Bounces".
- **Main content:** A data table listing suppressed contacts, the affected channel (SMS, Email, Push), the reason (User Opt-out, Invalid Number), and the timestamp. A restricted action menu allows admins to manually remove a suppression block only if they have documented consent.
- **Components:** KPI Tiles, Data Table, Status Badge, Contextual Action Menu.
- **Mockup filenames:** `ADM-47-suppression-admin-desktop.png`.

#### ADM-48 - Social connections, authorization health, failures, and manual-copy fallback

- **Route and roles:** `/admin/communications/social` | League Admin.
- **Primary goal and action:** Monitor API connections to social media platforms and provide a manual workaround if integrations fail.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Connection status cards for Facebook, Instagram, X, etc., displaying a clear `color.status.success` (Connected) or `color.status.danger` (Token Expired) badge.
- **Main content:** A log of recent social posts and their API delivery status. If an API failure occurs, a "Manual Fallback" button appears, opening a drawer containing formatted plain text and a downloadable generated image graphic (from COM-05/06) so the admin can post it manually.
- **Components:** Connection Card, Status Badge, Data Table, Drawer, Image Download Card.
- **Mockup filenames:** `ADM-48-social-connections-desktop.png`.

#### ADM-49 - AI game-recap queue

- **Route and roles:** `/admin/media/ai-queue` | League Admin.
- **Primary goal and action:** Track completed games awaiting AI recap generation and direct admins to the review workflow.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "AI Recap Generation Queue" header with filters for Division and Date.
- **Main content:** A list of games marked "Official Final" that do not yet have published recaps. Badges indicate generation status: "Pending Data", "Generating", "Draft Ready", or "Failed". Rows marked "Draft Ready" feature a prominent primary action button routing to the ADM-50 split-view editor.
- **Components:** List Item, Status Badge, Button Primary, Filter Bar.
- **Mockup filenames:** `ADM-49-ai-recap-queue-desktop.png`.

#### ADM-50 - AI Recap Review

- **Layout:** Split-view Admin Workbench.
- **Target viewport:** Desktop (1440).
- **Primary action:** Fact-check and approve/reject drafted media releases.
- **Above the fold:** Warning badge: "AI-generated content requires named human approval."
- **Main content:** **Left Pane (Scrollable):** Deterministic source facts. Displays the official box score, line score, and notable play log in a read-only data grid. **Right Pane (Scrollable):** The AI-generated article text within an editable text area. **Sticky Bottom Bar:** Decision controls for "Approve & Stage", "Regenerate", or "Reject".
- **Components:** Split Pane, Read-only Data Grid, Text Area, Sticky Action Bar.
- **Mockup filename:** `ADM-50-ai-recap-review-desktop.png`, `ADM-50-ai-recap-review-desktop-annotated.png`

#### ADM-51 - Weekly media-release builder with recaps, box scores, standings, leaders, fact check, approval, and preview

- **Route and roles:** `/admin/media/weekly-builder` | League Admin.
- **Primary goal and action:** Aggregate the week's data and approved recaps into a comprehensive press release for local media outlets.
- **Layout and target viewport:** Resumable Stepper Workbench | Desktop (1440).
- **Above the fold:** Stepper progression: "1. Select Week → 2. Pull Content → 3. Fact Check → 4. Preview & Send".
- **Main content:** Pull Content Step: A checklist allowing the admin to include/exclude specific game recaps, updated standings, and the weekly leaderboards. Fact Check Step: Displays all aggregated data alongside a required "I have verified these facts" checkbox. Preview Step: Renders the final HTML email and plain text formats.
- **Components:** Stepper, Checkbox List, Rich Text Editor, Checkbox (Mandatory), Preview Frame.
- **Mockup filenames:** `ADM-51-weekly-media-builder-desktop.png`.

#### ADM-52 - Media outlets, contacts, subscriptions, and delivery history

- **Route and roles:** `/admin/media/outlets` | League Admin.
- **Primary goal and action:** Manage the directory of local journalists, radio stations, and newspapers subscribed to the weekly release.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** "Media Directory" header and "Add Contact" button.
- **Main content:** A data table displaying Outlet Name, Primary Contact, Email, and Subscription Status (Active/Unsubscribed). Clicking a row reveals their individual delivery history and open rates for past releases.
- **Components:** Data Table, Badge, Button Primary.
- **Mockup filenames:** `ADM-52-media-directory-desktop.png`.

#### ADM-53 - Publication and correction history

- **Route and roles:** `/admin/media/history` | League Admin.
- **Primary goal and action:** Provide an immutable audit trail of all public announcements and specifically highlight any post-publication corrections.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Search bar and filters for "All Publications", "Press Releases", and "Corrections".
- **Main content:** A timeline view of publications. Any item that required an amendment after publishing (e.g., due to an overturned score protest) displays a high-contrast `color.status.warning` tag reading "Amended" and links to the original vs. corrected diff view.
- **Components:** Timeline List, Status Badge, Diff Viewer Link.
- **Mockup filenames:** `ADM-53-publication-history-desktop.png`.

#### ADM-54 - Reports and export hub

- **Route and roles:** `/admin/reports` | League Admin, Finance Officer.
- **Primary goal and action:** Centralized portal for generating all standard league documents and data extracts.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Categorized action cards: "Financial Reports", "Roster & Waiver Reports", "Schedule Reports", and "Statistical Exports".
- **Main content:** Clicking a category opens a panel with specific report parameters (e.g., Date Range, Division, Output Format: CSV/PDF). A sticky "Generate Report" button initiates the background job.
- **Components:** Action Cards, Parameter Form, Button Primary.
- **Mockup filenames:** `ADM-54-reports-export-hub-desktop.png`.

#### ADM-55 - End-of-season archive and portable tenant export

- **Route and roles:** `/admin/settings/archive` | League Admin.
- **Primary goal and action:** Safely lock a completed season into a read-only state and export the entire tenant database.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Extreme warning banner (`color.status.danger`) explaining that archiving a season locks all editing capabilities.
- **Main content:** Two distinct workflows: "Archive Season": Requires typing the season name to confirm the lock. "Portable Export": Generates a zip file containing all DB tables as CSVs and all signed waiver PDFs, securely transferring ownership of the data to the tenant.
- **Components:** Warning Banner, Typed Confirmation Input, Button Destructive, Download Button.
- **Mockup filenames:** `ADM-55-season-archive-desktop.png`.

#### ADM-56 - Audit explorer and event detail

- **Route and roles:** `/admin/audit` | League Admin.
- **Primary goal and action:** Investigate the system's unalterable security and operational logs to determine "who did what, and when".
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Complex querying interface: Actor (User), Action (e.g., "Score Altered", "Waiver Deleted"), Target Entity, and Date Range.
- **Main content:** A raw, dense data grid showing the chronological event stream. Clicking an event opens a drawer displaying the raw JSON payload of the change (Old Value vs. New Value).
- **Components:** Complex Filter Bar, Dense Data Grid, Drawer, Code/JSON Block.
- **Mockup filenames:** `ADM-56-audit-explorer-desktop.png`.

#### ADM-57 - Data-subject request and legal-hold workspace

- **Route and roles:** `/admin/settings/compliance` | League Admin (Restricted).
- **Primary goal and action:** Process right-to-be-forgotten requests while honoring legal holds on signed liability waivers.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Dashboard tracking pending "Account Deletion Requests".
- **Main content:** Processing a deletion request highlights any conflicting "Legal Holds" (e.g., a signed waiver from the current year). The interface forces the admin to anonymize the user's public profile data (stats, name on rosters) while isolating and securely retaining the immutable signature evidence required by law.
- **Components:** Alert Banner, Data Table, Action Menu, Warning Dialog.
- **Mockup filenames:** `ADM-57-data-subject-request-desktop.png`.

#### ADM-58 - Provider connections, tenant settings, feature flags, and fallback state

- **Route and roles:** `/admin/settings/providers` | League Admin (Restricted).
- **Primary goal and action:** Manage backend IT configurations, payment gateway API keys, and email service providers.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** Tabs grouping integrations: "Payments (Stripe)", "Email (SendGrid)", "SMS (Twilio)", "AI Models".
- **Main content:** Form inputs for API keys obscured by default (using password-style masking). Toggle switches for feature flags (e.g., "Enable AI Media Generation"). Read-only connection health indicators (Green/Red dots) confirm if the API keys are currently valid.
- **Components:** Tabs, Obscured Text Input, Toggle Switch, Connection Status Indicator.
- **Mockup filenames:** `ADM-58-provider-connections-desktop.png`.

#### ADM-59 - System health, failed jobs, provider status, backup and restore, and supported mobile versions

- **Route and roles:** `/admin/system/health` | Platform Operator (Super Admin).
- **Primary goal and action:** Monitor the technical infrastructure, retry failed background jobs, and enforce mobile app version minimums.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A prominent "System Health" traffic light indicator (e.g., Green for Operational, Red for Outage). KPI tiles for "Uptime", "Active Background Jobs", and "Failed Jobs".
- **Main content:** Job Queue: A data table listing failed asynchronous tasks (e.g., "Failed to send 14 SMS messages") with a "Retry All" action button. Mobile Versions: A control panel defining the minimum supported iOS and Android app versions. Setting a version here immediately forces out-of-date clients to update before syncing data.
- **Components:** KPI Tiles, Data Table, Version Input Controls, Button Warning (Retry).
- **Mockup filenames:** `ADM-59-system-health-desktop.png`.

#### ADM-60 - Future tournament seeding and bracket concept (Post-MVP)

- **Route and roles:** `/admin/tournament` | League Admin.
- **Primary goal and action:** Provide a conceptual design for automated tournament seeding and bracket management for post-MVP development.
- **Layout and target viewport:** Admin Workbench | Desktop (1440).
- **Above the fold:** A prominent, non-dismissible banner clearly labeling the page as "POST-MVP CONCEPT: Tournament Module".
- **Main content:** A horizontally scrolling, interactive bracket tree component. The UI demonstrates how final regular-season standings automatically populate the #1 through #8 seeds. Admin override handles are shown to manually adjust matchups.
- **Components:** Alert Banner, Bracket Tree Component (Concept), Draggable Matchup Cards.
- **Mockup filenames:** `ADM-60-tournament-bracket-concept-desktop.png`.

#### ADM-61 - Future commercial platform tenant onboarding (Post-MVP)

- **Route and roles:** `/platform/tenants` | Platform Operator.
- **Primary goal and action:** Provide a conceptual design for scaling the platform to support multiple distinct leagues (tenants) commercially.
- **Layout and target viewport:** Platform Operator Workbench | Desktop (1440).
- **Above the fold:** A prominent banner clearly labeling the page as "POST-MVP CONCEPT: Multi-Tenant Platform".
- **Main content:** A dashboard listing active tenants (e.g., "Meade County Church League", "Elizabethtown Adult Softball"). Columns track Active Users, Subscription Tier, and Platform Health. An "Onboard New League" wizard concept demonstrates feature entitlement toggles and initial branding setup.
- **Components:** Alert Banner, Tenant Data Table, Toggle Switch (Feature Entitlement).
- **Mockup filenames:** `ADM-61-tenant-onboarding-concept-desktop.png`.

### 8.4 Android and iOS native application

#### MOB-01 - Invitation, sign in, MFA, and role or organization switch

- **Route and roles:** Native App Launch | All Authenticated Users.
- **Primary goal and action:** Authenticate the user securely and route them to the correct contextual dashboard.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Clean, brand-neutral login screen (until the user's league is identified via email/token).
- **Main content:** Email/Password inputs. Upon successful credential entry, an MFA code input appears if enabled. If the user belongs to multiple roles (e.g., Coach for Team A, Player for Team B) or multiple leagues, a bottom sheet immediately prompts them to select their active context for the session.
- **Components:** Text Input, Password Input, OTP/MFA Input Grid, Bottom Sheet (Role Switcher).
- **Mockup filenames:** `MOB-01-sign-in-mobile.png`, `MOB-01-role-switch-mobile.png`.

#### MOB-02 - Personalized Home or Today

- **Route and roles:** Native App / Home Tab | Player, Guardian, Coach.
- **Primary goal and action:** Serve as the central hub outlining immediate responsibilities and the upcoming schedule.
- **Layout and target viewport:** Native Mobile Shell (Bottom Nav) | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Today" header. An "Action Required" widget pinned to the top if the user has unsigned documents or an unpaid balance.
- **Main content:** A vertically scrolling feed prioritizing the next immediate game card (with RSVP buttons). Below the next game, a concise summary of recent team announcements or league news.
- **Components:** Alert Widget, Matchup Card, RSVP Button Group, Bottom Navigation.
- **Mockup filenames:** `MOB-02-personalized-home-mobile.png`.

#### MOB-03 - My schedule

- **Route and roles:** Native App / Schedule Tab | Player, Guardian, Coach.
- **Primary goal and action:** View all personal upcoming and past games across all managed teams.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Sticky tab controls allowing the user to toggle between "Upcoming" and "Past".
- **Main content:** A chronological list of games. To save vertical space, matchup cards are compact, showing Date, Time, Opponent, and Field Status. A distinct visual indicator (e.g., a colored dot or subtle border) denotes which team the game belongs to if the user manages multiple.
- **Components:** Segmented Control, Compact Matchup Card, Bottom Navigation.
- **Mockup filenames:** `MOB-03-my-schedule-mobile.png`.

#### MOB-04 - Game detail, field status, directions, and RSVP or check-in

- **Route and roles:** Native App / Game Detail | Player, Guardian, Coach.
- **Primary goal and action:** View logistics for a specific game, confirm attendance, and get directions to the field.
- **Layout and target viewport:** Native Full-Screen Route | iOS Phone (393) / Android Phone (412).
- **Above the fold:** A persistent top app bar with a back button. A large header showing the matchup and the current Field Status (linked to the canonical status).
- **Main content:** A large Map block (placeholder) with a primary "Get Directions" button. Below this, a large RSVP segmented control (Going, Not Going, Undecided) specifically scaled for touch accessibility. For coaches, a summary of player RSVPs is visible below.
- **Components:** App Header, Map Placeholder, Button Primary, Segmented Control (RSVP).
- **Mockup filenames:** `MOB-04-game-detail-mobile.png`.

#### MOB-05 - Team roster and eligibility

- **Route and roles:** Native App / Team Tab | Player, Coach.
- **Primary goal and action:** View teammates, contact info (if shared), and track game-day eligibility.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Team name header and a filter bar (e.g., "All Players", "Eligible", "Action Required" for coaches).
- **Main content:** A scrollable list of player rows. Each row displays the player's avatar, name, and jersey number. For coaches, each row explicitly shows an eligibility badge (Emerald for cleared, Amber/Red for missing waivers). Tapping a row opens a bottom sheet with contact details or the eligibility explanation.
- **Components:** List Item, Avatar, Eligibility Badge, Bottom Sheet.
- **Mockup filenames:** `MOB-05-team-roster-mobile.png`.

#### MOB-06 - Player or guardian task hub and document status

- **Route and roles:** Native App / Tasks | Player, Guardian.
- **Primary goal and action:** Identify and resolve missing paperwork directly from the phone.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** A "Required Documents" header with a progress ring (e.g., "1 of 3 Completed").
- **Main content:** A list of specific waiver and form requirements. Each item has a status icon. Tapping a "Missing" item immediately launches the MOB-07 full-screen signature flow. Completed items show a "View Signed Receipt" link.
- **Components:** Progress Ring, Document List Item, Status Icon, Text Link.
- **Mockup filenames:** `MOB-06-task-hub-mobile.png`.

#### MOB-07 - Mobile waiver consent, review, signature, and receipt

- **Route and roles:** Native App / Waiver Flow | Player, Guardian.
- **Primary goal and action:** Legally execute a waiver on a mobile device without truncating the required text.
- **Layout and target viewport:** Native Task Screen (Full-Screen Sequential) | iOS Phone (393) / Android Phone (412).
- **Above the fold:** A step indicator (e.g., "Step 1 of 3: Consent to Electronic Records").
- **Main content:** Step 1 (Consent): Brief legal text and an "I Consent" button. Step 2 (Review): The complete, immutable legal body in a scrollable view. The "Continue" button remains disabled until the user scrolls to the bottom of the text. Step 3 (Sign): Inputs to type the legal name, a mandatory checkbox confirming intent, and a primary "Sign & Submit" button.
- **Components:** Stepper, Scrollable Text View, Form Input, Checkbox, Button Primary.
- **Mockup filenames:** `MOB-07-mobile-waiver-flow-mobile.png`.

#### MOB-08 - Alerts, urgent acknowledgement, and preferences

- **Route and roles:** Native App / Alerts | All Authenticated Users.
- **Primary goal and action:** Read league/team notifications and explicitly acknowledge urgent alerts (e.g., "Field Closed - Acknowledge Receipt").
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Alerts & Messages" header. A segmented control toggling between "Unread" and "All".
- **Main content:** A vertically scrolling list of notification cards. Standard messages display a read/unread dot. Urgent alerts display a `color.status.danger` border and feature a mandatory, full-width "Tap to Acknowledge" primary button directly on the card.
- **Components:** Segmented Control, Alert Card, Button Destructive (Acknowledgement), Icon Button (Preferences Gear).
- **Mockup filenames:** `MOB-08-alerts-acknowledgement-mobile.png`.

#### MOB-09 - Coach lineup and eligibility

- **Route and roles:** Native App / Coach Tools | Coach/Manager.
- **Primary goal and action:** Allow coaches to set their batting order and fielding positions on their phone just before the game.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** A sticky validation banner (e.g., "Lineup Valid" or "Missing 1 Female Player").
- **Main content:** A drag-and-drop list representing the Batting Order. Unlike the desktop version (TEAM-16), space is conserved by hiding the "Available Pool" behind a persistent floating action button (FAB) or a sticky bottom sheet labeled "Add Player to Lineup". Ineligible players in the pool are visually dimmed.
- **Components:** Sticky Validation Banner, Draggable List Item, Floating Action Button, Bottom Sheet.
- **Mockup filenames:** `MOB-09-coach-lineup-mobile.png`.

#### MOB-10 - Scorekeeper game assignments

- **Route and roles:** Native App / Officiating | Scorekeeper.
- **Primary goal and action:** View upcoming scoring shifts and confirm availability.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "My Assignments" header.
- **Main content:** A list of assigned games. Each card shows Date, Time, Field, and Matchup. If the assignment is pending, large "Confirm" (Emerald) and "Decline" (Slate) buttons are prominent on the card. Confirmed games show a `color.status.success` badge.
- **Components:** Matchup Card, Button Group (Confirm/Decline), Status Badge.
- **Mockup filenames:** `MOB-10-scorekeeper-assignments-mobile.png`.

#### MOB-11 - Pregame package and offline-readiness check

- **Route and roles:** Native App / Pregame | Scorekeeper.
- **Primary goal and action:** Ensure the scorekeeper's device has downloaded all required data to score the game completely offline if field connectivity drops.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Game Header (Away vs. Home).
- **Main content:** A strict readiness checklist: "1. Device Battery > 50%", "2. Download Away Roster", "3. Download Home Roster", "4. Download League Rules". A large, primary "Download Offline Package" button. Once downloaded, a bold "Ready for Offline Scoring" badge appears.
- **Components:** Checklist Item, Button Primary, Status Badge, Progress Indicator.
- **Mockup filenames:** `MOB-11-pregame-offline-check-mobile.png`.

#### MOB-12 - Lineup review and validation

- **Route and roles:** Native App / Pregame | Scorekeeper, Umpire.
- **Primary goal and action:** Confirm the coaches' submitted lineups match the physical plate meeting before enabling the "Start Game" action.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Sticky tab control toggling between "Away Lineup" and "Home Lineup".
- **Main content:** A read-only list of the 1-12 batting order. The scorekeeper physically verifies this against the paper lineup card provided by the coach. A sticky bottom action bar contains a slider to "Swipe to Confirm Lineups & Start Game", preventing accidental taps.
- **Components:** Tabs, List Item, Swipe-to-Confirm Slider, Sticky Action Bar.
- **Mockup filenames:** `MOB-12-lineup-review-mobile.png`.

#### MOB-13 - Live Scorekeeping (Connected)

- **Layout:** Native mobile full-viewport (Game Mode).
- **Above the fold:** Fixed compact header. Top left: Inning/Outs. Top Right: Live Sync Status dot (Emerald Green). Center: Current Score.
- **Main content:** Large 64px hit targets for primary scoring actions (Ball, Strike, Foul, In Play). Current batter profile is visible immediately above the action pad.
- **Below the fold:** A sticky bottom sheet handle for "Runner Movement / Substitutions".
- **Components:** Scoreboard Header, Sync Badge, Oversized Action Buttons, Bottom Sheet.

#### MOB-14 - Tablet-landscape live-scorekeeping layout

- **Route and roles:** Native App / Game Mode | Scorekeeper.
- **Primary goal and action:** Utilize the expanded horizontal space of a tablet to present the lineup, action pad, and play log simultaneously without sheet overlays.
- **Layout and target viewport:** Full-Viewport Game Day Screen | Tablet Landscape (1194 x 834).
- **Above the fold:** Fixed top scoreboard spanning the full width, displaying the synchronization state, inning, outs, and base state.
- **Main content:** Three distinct panes: Left Pane (25%): Lineup and current batter context. Center Pane (50%): Current plate appearance, base runner visualizer, and large 64px scoring action pad. Right Pane (25%): Ordered play log showing the reverse-chronological event timeline.
- **Components:** Three-Pane Layout, Scoreboard Header, Oversized Action Buttons, Event Timeline List.
- **Mockup filenames:** `MOB-14-live-scorekeeping-tablet-landscape.png`.

#### MOB-15 - Plate-appearance result and runner-movement sheet

- **Route and roles:** Native App / Game Mode Overlay | Scorekeeper.
- **Primary goal and action:** Resolve complex plays accurately (e.g., a double where the runner on second scores, but the runner on first is thrown out at third).
- **Layout and target viewport:** Bottom Sheet | iOS Phone (393) / Android Phone (412).
- **Above the fold:** The primary scoreboard and sync state remain completely visible while the sheet is open to preserve context.
- **Main content:** The sheet slides up displaying logical questions based on the base state. E.g., "Result of Batter: [Hit, Out, Reached on Error]". If a hit is selected, individual rows appear for each active baserunner with toggles for "Advanced to 2nd", "Scored", or "Out at 3rd". A sticky "Confirm Play" button executes the complete atomic event.
- **Components:** Bottom Sheet, Segmented Control (Result), Toggle Switch (Runner Movement), Button Primary.
- **Mockup filenames:** `MOB-15-runner-movement-sheet-mobile.png`.

#### MOB-16 - Substitution and special-runner workflow

- **Route and roles:** Native App / Game Mode Overlay | Scorekeeper.
- **Primary goal and action:** Execute legal roster changes mid-game, explicitly defining courtesy runners or defensive swaps.
- **Layout and target viewport:** Full-Screen Overlay | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Substitution" header with a "Cancel" text button.
- **Main content:** **Step 1:** Select the player leaving the game. **Step 2:** Select the player entering from the eligible bench. **Step 3:** Define the role (e.g., "Courtesy Runner", "Offensive Sub", "Defensive Only"). The UI enforces league rules, dimming players who have already exhausted their re-entry rights.
- **Components:** Full-Screen Modal, List Item (Selectable), Radio Group, Button Primary.
- **Mockup filenames:** `MOB-16-substitution-workflow-mobile.png`.

#### MOB-17 - Correction, undo-event, and event-history workflow

- **Route and roles:** Native App / Game Mode Overlay | Scorekeeper.
- **Primary goal and action:** Fix a scoring mistake safely. Undo actions must never silently delete history; they must append a correction event.
- **Layout and target viewport:** Bottom Sheet | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Play History & Corrections" header.
- **Main content:** A scrollable list of the last 5 plays. The most recent play has an active, destructive "Undo Last Play" button. Tapping it triggers a confirmation dialog warning that a correction event will be broadcast to the server and spectators. Older plays require selecting "Protest/Flag for Admin Review" rather than a direct undo to preserve database integrity.
- **Components:** Bottom Sheet, Event Timeline List, Button Destructive, Alert Dialog.
- **Mockup filenames:** `MOB-17-correction-undo-mobile.png`.

#### MOB-18 - Delay, suspension, resumption, forfeit, protest, incident, and scorer-transfer controls

- **Route and roles:** Native App / Game Mode Options | Scorekeeper, Umpire.
- **Primary goal and action:** Handle exceptional game states, weather delays, and technical transfers without abandoning the scoring session.
- **Layout and target viewport:** Modal Menu | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Game Controls" modal accessed via a gear icon in the distraction-free UI.
- **Main content:** A grid or list of high-consequence actions: "Record Rain Delay" (pauses the game clock), "Record Forfeit", "Log Protest/Incident", and "Transfer Writer Lease" (generates a QR code or code phrase allowing a relief scorekeeper to scan and take over the live session). All actions require a secondary confirmation.
- **Components:** Modal Menu, List Item (Icon + Text), QR Code Display (for transfer), Confirmation Dialog.
- **Mockup filenames:** `MOB-18-game-controls-menu-mobile.png`.

#### MOB-19 - Offline queue, reconnect, writer-lease conflict, and reconciliation

- **Route and roles:** Native App / Synchronization | Scorekeeper.
- **Primary goal and action:** Reconnect to the network, review pending offline event queues, and resolve any split-brain writer-lease conflicts without losing local play records.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** High-contrast status banner with an amber-to-emerald sync pulse: "Reconnected — 18 Local Events in Queue — Reconciling with Server".
- **Main content:** Event Queue View: An ordered chronological list of unpushed plays recorded on device. Conflict Resolution Pane: If another scorekeeper or admin claimed the writer lease during the offline window, a side-by-side diff card displays the server timeline versus the local device timeline. Action Controls: Distinct action buttons to "Replay & Merge Local Plays" (primary), "Review Individual Conflicts", or "Accept Server State as Authoritative".
- **Sticky and scrollable regions:** Conflict summary and "Reconcile Now" button remain sticky at the bottom.
- **Components:** Sync Status Badge (`color.status.pendingSync`), Event Queue List, Split Diff Card, Button Primary, Button Warning.
- **Mockup filenames:** `MOB-19-offline-reconnect-mobile.png`, `MOB-19-scorekeeping-offline-conflict.png`.

#### MOB-20 - Submit Game Offline

- **Layout:** Native mobile task screen.
- **Above the fold:** High-visibility Warning Header (Amber) reading "Offline: 42 Events Saved to Device".
- **Main content:** A final review line score. An exact replica of the official scorebook requirements. A distinct "Attest & Save Offline" primary button.
- **Error prevention:** The app will physically not allow the user to exit this view without acknowledging that the device must be reconnected to Wi-Fi/Cellular within 24 hours to transmit the official payload.
- **Components:** Warning Banner, Read-Only Line Score, Acknowledgment Checkbox, Button Primary.

#### MOB-21 - Umpire assignments and confirmation

- **Route and roles:** Native App / Umpire Hub | Umpire.
- **Primary goal and action:** View scheduled game officiating assignments, check field allocations, and confirm or decline slots.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** "Umpire Assignments" top bar with a segmented control toggling between "Upcoming" and "Past Attestations".
- **Main content:** Chronological feed of assignment cards. Each card details the Date, Game Time, Venue/Field, Matchup, Role Assignment (Plate Umpire vs. Base Umpire), Partner Umpire, and Scheduled Fee Payout. Pending assignments feature prominent "Accept Assignment" (Emerald) and "Decline" (Slate) action buttons.
- **Components:** Segmented Control, Matchup/Assignment Card, Button Group, Fee Badge, Status Badge.
- **Mockup filenames:** `MOB-21-umpire-assignments-mobile.png`.

#### MOB-22 - Umpire submitted-book review, discrepancy return, notes, and attestation

- **Route and roles:** Native App / Postgame Attestation | Umpire.
- **Primary goal and action:** Review the scorekeeper's submitted official scorebook post-game and digitally attest or return with discrepancy notes.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Game header with a persistent amber banner: "Submitted Scorebook — Awaiting Official Attestation".
- **Main content:** Inning-by-Inning Line Score: Compact grid displaying Runs, Hits, and Errors per inning for both teams. Decision Actions: Sticky primary button "Sign & Attest Official Book" (which captures cryptographic attestation) and secondary button "Return with Discrepancy" (which opens a bottom sheet requiring specific error notes to route back to the scorekeeper).
- **Components:** Scoreboard Summary Card, Line Score Grid, Bottom Sheet (Discrepancy Notes), Button Primary, Button Secondary.
- **Mockup filenames:** `MOB-22-umpire-attestation-review-mobile.png`.

#### MOB-23 - Authorized offline attestation and Attested offline - pending sync

- **Route and roles:** Native App / Offline Game Mode | Umpire, Scorekeeper.
- **Primary goal and action:** Capture the umpire's digital signature directly on the scorekeeper's device when the field has zero cellular or Wi-Fi connectivity.
- **Layout and target viewport:** Native Task Screen (Distraction-Free) | iOS Phone (393) / Android Phone (412).
- **Above the fold:** High-contrast amber badge reading: "Attested offline — pending sync" (`color.status.pendingSync`).
- **Main content:** Summary box score and locked event ledger. The umpire inputs their 4-digit security PIN or provides a typed legal name on the scorekeeper's screen. An explicit nonblocking legal confirmation states: "Attestation recorded locally. Official Final status will be awarded automatically once this device re-establishes network connection.".
- **Components:** Offline Warning Header, Read-Only Line Score, PIN Entry Canvas, Button Primary.
- **Mockup filenames:** `MOB-23-offline-attestation-mobile.png`.

#### MOB-24 - Awaiting-online umpire and later online attestation

- **Route and roles:** Native App / Remote Attestation | Umpire.
- **Primary goal and action:** Allow an umpire who left the field before scorebook sync to review and attest the game remotely from their own device once the scorekeeper connects.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Alert banner: "Action Required: 1 Completed Game Awaiting Your Final Remote Attestation".
- **Main content:** Complete digital scorebook audit view. Read-only timeline of all runs scored, substitutions, and inning transitions. A mandatory legal checkbox: "I certify that this scorebook reflects the official final outcome of the game." Sticky action bar with "Submit Digital Attestation".
- **Components:** Alert Banner, Scorebook Timeline Viewer, Checkbox, Sticky Action Bar.
- **Mockup filenames:** `MOB-24-remote-umpire-attestation-mobile.png`.

#### MOB-25 - Official-final receipt and downloadable official book

- **Route and roles:** Native App / Game Summary | Scorekeeper, Umpire, Coach.
- **Primary goal and action:** View the certified postgame receipt, official final timestamp, and download the official scorebook PDF.
- **Layout and target viewport:** Native Task Screen | iOS Phone (393) / Android Phone (412).
- **Above the fold:** High-contrast `color.status.officialFinal` dark banner: "Official Final — Game Certified" with verified timestamp and assigned umpire ID.
- **Main content:** Certified line score, key individual batting and pitching statistics, and an audit metadata card. A full-width primary button: "Download Official Scorebook PDF" (triggers DOC-09 artifact generation).
- **Components:** Official Final Banner, Line Score Card, Metadata KPI Tile, Button Primary (PDF Download).
- **Mockup filenames:** `MOB-25-official-final-receipt-mobile.png`.

#### MOB-26 - Fan live-game following, connected

- **Route and roles:** Native App / Fan Live View | Public Spectator.
- **Primary goal and action:** Follow live softball games in real time with pitch-by-pitch and play-by-play updates.
- **Layout and target viewport:** Native Mobile Shell (Read-Only) | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Live scoreboard with Emerald "Live and synced" badge, inning half, out indicator dots, and interactive base runner diamond.
- **Main content:** Live play feed with auto-scroll toggle, batting order preview, and line score table. Read-only architecture strictly ensures no scorekeeping or admin controls appear.
- **Components:** Scoreboard Header, Base Diamond Visualizer, Live Timeline Feed, Segmented Tab Bar.
- **Mockup filenames:** `MOB-26-fan-live-connected-mobile.png`.

#### MOB-27 - Fan live-game following with interrupted updates

- **Route and roles:** Native App / Fan Live View | Public Spectator.
- **Primary goal and action:** Clearly communicate a scorekeeper network outage to fans without displaying stale data as live.
- **Layout and target viewport:** Native Mobile Shell (Read-Only) | iOS Phone (393) / Android Phone (412).
- **Above the fold:** Persistent amber banner: "Live updates temporarily interrupted — Displaying last synced state at 7:42 PM (Bottom 4th)".
- **Main content:** Displays the last verified score and play. Live pulse animations are suspended. A subtle polling spinner indicates the app is actively listening for reconnection without refreshing the entire screen.
- **Components:** Interruption Banner (`color.status.warning`), Stale State Timeline, Polling Status Indicator.
- **Mockup filenames:** `MOB-27-fan-live-interrupted-mobile.png`.

#### MOB-28 - Mobile profile, security, notifications, privacy, public-profile controls, export, and deletion

- **Route and roles:** Native App / More Tab / Profile | All Authenticated Users.
- **Primary goal and action:** Manage personal credentials, multi-factor authentication, dependent minor privacy controls, notifications, and data export/deletion requests.
- **Layout and target viewport:** Native Mobile Shell | iOS Phone (393) / Android Phone (412).
- **Above the fold:** User Avatar, Full Name, Role Badges (e.g., "Coach", "Parent"), and Primary Account Email.
- **Main content:** Grouped settings list: Security: MFA configuration, password update, active sessions. Household & Privacy: Dependent minor public visibility toggles. Communications: SMS, Push, and Email alert preferences. Account Compliance: "Export My Data" and "Request Account Deletion" (destructive action with confirmation gate).
- **Components:** Profile Header, Grouped Settings List, Toggle Switch, Button Destructive.
- **Mockup filenames:** `MOB-28-mobile-profile-settings-mobile.png`.

### 8.5 Authentication and system states

#### SYS-01 - Sign in

- **Route and roles:** `/auth/sign-in` | All Users.
- **Primary goal and action:** Authenticate users securely with email/password, magic link, or passkey credentials.
- **Layout and target viewport:** Centered Auth Shell | Desktop (1440) / Mobile (393).
- **Above the fold:** Clean Meade County Church Softball League typography and wordmark header. A focused, 420px authentication card centered in the viewport.
- **Main content:** Email input, Password input (with show/hide eye toggle), "Remember Me" checkbox, "Forgot Password?" link, and a full-width primary "Sign In" button. Secondary button: "Sign in with Magic Link".
- **Components:** Centered Auth Card, Form Inputs, Checkbox, Button Primary, Button Secondary.
- **Mockup filenames:** `SYS-01-sign-in-desktop.png`, `SYS-01-sign-in-mobile.png`.

#### SYS-02 - Invitation acceptance and account creation

- **Route and roles:** `/auth/accept-invite` | Unauthenticated Users (with valid token).
- **Primary goal and action:** Seamlessly transition an invited user (e.g., a drafted player or assigned scorekeeper) into a fully registered account.
- **Layout and target viewport:** Centered Auth Shell | Desktop (1440) / Mobile (393).
- **Above the fold:** A welcoming header confirming the context: "You've been invited to join the Meade County Church Softball League by Coach Smith.".
- **Main content:** The user's email is pre-filled and locked. Form inputs require First Name, Last Name, Password creation, and Password Confirmation. A mandatory checkbox to accept the Terms of Service and Privacy Policy. Primary action: "Create Account & Join Team".
- **Components:** Centered Auth Card, Form Inputs, Checkbox, Button Primary.
- **Variants and states:** Expired Invitation (displays `color.status.danger` alert and instructions to contact the admin).
- **Mockup filenames:** `SYS-02-invitation-acceptance-desktop.png`, `SYS-02-invitation-acceptance-mobile.png`.

#### SYS-03 - Password recovery, reset, and MFA verification

- **Route and roles:** `/auth/recovery` | All Users.
- **Primary goal and action:** Allow users to regain access to their accounts securely without administrative intervention.
- **Layout and target viewport:** Centered Auth Shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "Reset Password" header with clear, concise instructions.
- **Main content:** **Step 1 (Request):** Email input and "Send Recovery Link" button. **Step 2 (Reset):** New Password and Confirm Password inputs. **Step 3 (MFA Challenge):** If the account has MFA enabled, a 6-digit OTP grid appears before granting access.
- **Components:** Centered Auth Card, Form Inputs, OTP/MFA Input Grid, Button Primary.
- **Mockup filenames:** `SYS-03-password-recovery-desktop.png`, `SYS-03-mfa-verification-mobile.png`.

#### SYS-04 - Offline, permission-denied, error, and maintenance state board

- **Route and roles:** Global Error States | All Users.
- **Primary goal and action:** Provide clear, actionable, and non-frustrating dead-end screens when system exceptions occur.
- **Layout and target viewport:** Centered Error Shell | Desktop (1440) / Mobile (393).
- **Main content:** A collection of state boards. Each features a large, friendly iconography system (e.g., a broken bat for 404, a locked gate for 403 Permission Denied). The text clearly explains the issue without technical jargon (e.g., "Maintenance: The league scheduler is currently running optimizations. Back in 15 minutes."). All states include a primary "Return to Dashboard" or "Contact Support" button.
- **Components:** Large Icon/Illustration, Alert Header, Body Text, Button Primary.
- **Mockup filenames:** `SYS-04-error-states-board-desktop.png`.

### 8.6 Account and personal settings

#### ACC-01 - Personal profile and household

- **Route and roles:** `/portal/account/profile` | All Authenticated Users.
- **Primary goal and action:** Manage core identity details, avatar, and view associated household connections.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "My Profile" header. Avatar upload widget with the user's current photo or initials.
- **Main content:** Form inputs for Legal First Name, Last Name, Phone Number, and Address. A separate section titled "Household" displays read-only summary cards of managed minors or linked accounts (acting as a bridge to TEAM-14). Sticky bottom bar for "Save Changes".
- **Components:** Avatar Upload, Form Inputs, Summary Card, Sticky Action Bar.
- **Mockup filenames:** `ACC-01-personal-profile-desktop.png`.

#### ACC-02 - Security, MFA, and active sessions

- **Route and roles:** `/portal/account/security` | All Authenticated Users.
- **Primary goal and action:** Secure the user's account against unauthorized access and review active logins.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "Account Security" header. A prominent toggle switch for "Two-Factor Authentication (MFA)".
- **Main content:** **Password Section:** Inputs to change the current password. **Active Sessions:** A list displaying current and recent logins (e.g., "MacBook Pro -Chrome - Louisville, KY"). Each row features a "Revoke Session" text button to force a remote logout.
- **Components:** Toggle Switch, Form Inputs, Session List Item, Button Destructive (Text).
- **Mockup filenames:** `ACC-02-security-mfa-desktop.png`.

#### ACC-03 - Notification and communication preferences

- **Route and roles:** `/portal/account/notifications` | All Authenticated Users.
- **Primary goal and action:** Give users granular control over how and when the league contacts them.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "Communication Preferences" header.
- **Main content:** A matrix layout of toggles. Rows represent event types: "Game Reminders", "Weather Alerts", "Team Chat", "League Newsletter". Columns represent delivery channels: "Email", "SMS", "Push". Users can customize exactly which channels receive which alerts. Urgent safety/weather alerts may lock the SMS toggle to "On" if required by league policy, displaying a lock icon and tooltip explanation.
- **Components:** Toggle Matrix, Tooltip, Icon (Lock).
- **Mockup filenames:** `ACC-03-notification-preferences-desktop.png`.

#### ACC-04 - Privacy, public-profile permissions, data export, and account-deletion request

- **Route and roles:** `/portal/account/privacy` | All Authenticated Users.
- **Primary goal and action:** Ensure absolute compliance with user privacy rights and data portability.
- **Layout and target viewport:** Authenticated operations shell | Desktop (1440) / Mobile (393).
- **Above the fold:** "Privacy & Data" header.
- **Main content:** **Public Visibility:** Toggles for "Show Full Name on Public Rosters" vs. "Use Initials", and "Show My Stats Publicly". **Data Export:** A "Request Data Export" button that queues a background job to package the user's data. **Danger Zone:** A red-bordered section containing the "Request Account Deletion" button, which triggers a secondary confirmation modal warning that signed waivers must legally be retained.
- **Components:** Toggle Switch, Button Secondary, Danger Zone Box, Button Destructive.
- **Mockup filenames:** `ACC-04-privacy-data-desktop.png`.

#### ACC-05 - Notification center and announcement detail

- **Route and roles:** `/portal/account/inbox` | All Authenticated Users.
- **Primary goal and action:** Provide a dedicated web inbox for users who missed push or email notifications.
- **Layout and target viewport:** Split-pane operations shell | Desktop (1440).
- **Above the fold:** "Notification Center" header.
- **Main content:** **Left Pane:** A scrollable list of message summaries (Sender, Subject, Time). Unread messages feature a bold font and a `color.status.info` dot indicator. **Right Pane:** The full content of the selected message. Includes action buttons if the message requires RSVP or document signing.
- **Components:** Split Pane, Message List Item, Read/Unread Indicator, Rich Text Block.
- **Mockup filenames:** `ACC-05-notification-center-desktop.png`.

### 8.7 Printed and PDF artifacts

#### DOC-01 - Team application and registration summary

- **Route and roles:** Printed, PDF, Email Artifact | Coach, League Admin.
- **Primary goal and action:** Provide a clean, printable, offline receipt of the completed team registration.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** A structured, high-contrast, black-and-white optimized layout. Top section displays League Logo, Season Year, and "Team Registration Receipt". Middle section presents a tabular summary of the Coach's details, Sponsoring Church, and the initial submitted roster. Bottom section outlines the fee paid, transaction ID, and timestamp.
- **Components:** Print Header, Data Table (Print Optimized), Transaction Summary Block.
- **Mockup filenames:** `DOC-01-team-application-summary.png`.

#### DOC-02 - Personalized team season packet

- **Route and roles:** Printed, PDF Artifact | Coach.
- **Primary goal and action:** Generate a comprehensive, multi-page offline dossier a coach can keep in their dugout binder.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** **Page 1 (Cover):** Team Name, Coach, Division, and Emergency League Contacts. **Page 2 (Official Roster):** The certified roster grid with a watermark indicating "Approved for League Play". **Page 3 (Schedule):** A tabular list of all team games for the season, including field locations. **Page 4+ (Rules):** Condensed local park rules and regulations.
- **Components:** Print Cover Sheet, Watermarked Table, Condensed Schedule List.
- **Mockup filenames:** `DOC-02-team-season-packet.png`.

#### DOC-03 - Roster and eligibility report

- **Route and roles:** Printed, PDF Artifact | League Admin, Coach.
- **Primary goal and action:** Provide a physical, offline-verifiable list of cleared players for game-day checks.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** A dense, high-contrast table optimized for black-and-white printing. Columns: Jersey Number, Player Name, Role, Waiver Status, and an empty "Checked In" column for physical use by officials. A prominent header displays the Team Name, Date Generated, and an "Official League Document" seal.
- **Components:** Print Header, Dense Data Table, Checkbox Placeholder (for manual marking).
- **Mockup filenames:** `DOC-03-roster-eligibility-report.png`.

#### DOC-04 - Blank waiver rendering

- **Route and roles:** Printed, PDF Artifact | League Admin, Player.
- **Primary goal and action:** Provide a legally accurate, offline paper alternative for users who do not consent to electronic signatures.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** The immutable, unabridged legal text of the waiver. The layout uses standard legal margins and legible serif or sans-serif typography (minimum 11pt). The footer contains a version hash checksum to ensure the printed version matches the active digital version. A clear signature block at the bottom includes lines for "Printed Name", "Signature", and "Date".
- **Components:** Rich Text Block (Unabridged), Document Footer (Checksum), Physical Signature Block.
- **Mockup filenames:** `DOC-04-blank-waiver-rendering.png`.

#### DOC-05 - Signed-waiver PDF and signing certificate

- **Route and roles:** Printed, PDF Artifact | Player, Guardian, League Admin.
- **Primary goal and action:** Produce a cryptographic, legally binding receipt of an executed electronic signature.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** Page 1: The exact, unaltered legal text agreed to by the user. **Page 2 (Certificate):** An attached signing certificate detailing the "Chain of Custody." It lists the Signer's explicitly typed legal name, IP address, exact UTC timestamp, browser user-agent, and a unique cryptographic document ID.
- **Components:** Rich Text Block, Digital Signature Audit Trail Card.
- **Mockup filenames:** `DOC-05-signed-waiver-certificate.png`.

#### DOC-06 - Printable league schedule

- **Route and roles:** Printed, PDF Artifact | League Admin, Public.
- **Primary goal and action:** Generate a comprehensive, easy-to-scan grid of all games for a specific time period (e.g., "Week 1 Schedule").
- **Layout and target viewport:** Printable Document / Landscape Letter | Print (11x8.5").
- **Main content:** A landscape-oriented matrix. Columns represent Fields (e.g., Field 1, Field 2), and Rows represent Time Slots (e.g., 6:00 PM, 7:15 PM). Each intersecting cell clearly lists the Away vs. Home matchup. Gray shading is used to indicate unused or blacked-out slots.
- **Components:** Matrix Data Table (Print Optimized), Cell Matchup Block.
- **Mockup filenames:** `DOC-06-printable-league-schedule.png`.

#### DOC-07 - Printable team-specific schedule

- **Route and roles:** Printed, PDF Artifact | Coach, Player, Guardian.
- **Primary goal and action:** Provide a refrigerator-friendly, one-page schedule for a specific team.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** A clean, vertical list grouping games by week or month. Highlights the team's perspective (e.g., bolding the Team Name in the matchup). Includes columns for Date, Time, Opponent, and Field/Venue. Space is left at the bottom for "Coach Notes" or contact info.
- **Components:** Print Header, Chronological List Table.
- **Mockup filenames:** `DOC-07-printable-team-schedule.png`.

#### DOC-08 - Invoice, payment receipt, and credit or refund notation

- **Route and roles:** Printed, PDF Artifact | Finance Officer, Coach.
- **Primary goal and action:** Produce standard financial documents for team accounting and tax purposes.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** A professional invoice layout. Top right: "Invoice #INV-2026-104" and Issue Date. Top left: League Logo and Remittance Address. Center: Billed To (Team/Church details). A clear tabular breakdown of line items (Registration Fee, Late Fee, Applied Credit). **Bottom:** Total Due or a large "PAID IN FULL" watermark/stamp across the center if the balance is zero.
- **Components:** Invoice Header, Line Item Table, Financial Summary Block, Payment Status Watermark.
- **Mockup filenames:** `DOC-08-invoice-receipt.png`.

#### DOC-09 - Official scorebook, event log, scorekeeper submission, umpire attestation, and amendment notation

- **Route and roles:** Printed, PDF Artifact | League Admin, Umpire.
- **Primary goal and action:** Export the absolute, immutable record of a completed game, acting as the digital equivalent of the physical paper book.
- **Layout and target viewport:** Printable Document / Landscape Letter | Print (11x8.5").
- **Main content:** **Top:** Classic line score box showing runs by inning. **Middle:** The verified batting order and detailed box score (AB, R, H, RBI). **Bottom (Crucial):** The Digital Attestation Block. This explicitly lists the names of the submitting Scorekeeper and the attesting Plate Umpire, alongside the exact UTC timestamp of certification. Any post-game amendments approved by an admin are appended as a final "Corrections Log" section.
- **Components:** Line Score Grid, Box Score Table, Audit Attestation Block, Corrections Log.
- **Mockup filenames:** `DOC-09-official-scorebook-pdf.png`.

#### DOC-10 - Box score and statistics report

- **Route and roles:** Printed, PDF, Email Artifact | Public, Media, Coaches.
- **Primary goal and action:** Provide a clean, shareable summary of game stats without the heavy audit/attestation metadata.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** Formatted similarly to traditional newspaper sports sections. Away team batting and pitching stats on the left or top, Home team stats adjacent or below. Includes a summary paragraph at the bottom noting highlights (e.g., "2B: Smith, Jones. HR: Davis.").
- **Components:** Classic Box Score Table, Highlight Summary Text.
- **Mockup filenames:** `DOC-10-box-score-report.png`.

#### DOC-11 - Schedule fairness and capacity report

- **Route and roles:** Printed, PDF Artifact | League Admin, Board Members.
- **Primary goal and action:** Provide analytical proof to the board or participating coaches that the schedule algorithm successfully balanced home/away games and field assignments.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** A comparative data table listing every team in the league. Columns evaluate fairness metrics: "Total Games", "Home Games", "Away Games", "Games on Field 1 vs. Field 2", and "Rest Days Average". A summary header highlights the standard deviation of these metrics to prove statistical parity.
- **Components:** Analytical Data Table, Metric Summary Blocks.
- **Mockup filenames:** `DOC-11-schedule-fairness-report.png`.

#### DOC-12 - Finance and budget report

- **Route and roles:** Printed, PDF Artifact | Finance Officer, Board Members.
- **Primary goal and action:** Generate an executive summary of the league's financial standing for board meetings.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** **Top:** High-level summary (Total Revenue, Total Expenses, Net Income). **Middle:** A breakdown comparing the "Projected Budget" (from ADM-23) against "Actual Expenses". **Bottom:** A list of outstanding receivables (teams with unpaid balances).
- **Components:** Executive Summary Header, Budget vs. Actual Table, Outstanding Accounts List.
- **Mockup filenames:** `DOC-12-finance-budget-report.png`.

#### DOC-13 - Communication delivery report

- **Route and roles:** Printed, PDF Artifact | League Admin.
- **Primary goal and action:** Provide an offline audit trail proving that a specific urgent message (e.g., a schedule change) was successfully delivered and acknowledged.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** **Header:** Message Subject, Sender, Date/Time Sent, and the exact canonical text of the message. **Summary:** Delivery percentages (e.g., 98% Delivered, 2% Bounced). **Recipient Table:** A dense list of all targeted users, their channels (Email/SMS/Push), delivery status, and timestamps of explicit in-app acknowledgments.
- **Components:** Print Header, KPI Summary Bar, Dense Audit Table.
- **Mockup filenames:** `DOC-13-communication-delivery-report.png`.

#### DOC-14 - Weekly press release with standings, highlights, statistics, and box scores

- **Route and roles:** Printed, PDF Artifact | League Admin, Media.
- **Primary goal and action:** Generate a polished, traditional press release suitable for newspaper printing or radio read-alongs.
- **Layout and target viewport:** Printable Document / Letter Size | Print (8.5x11").
- **Main content:** **Header:** "FOR IMMEDIATE RELEASE", Date, and League Contact Information. Body: The human-approved AI-drafted recap text (from ADM-50). Data: Embedded, print-optimized tables for current Standings and top Statistical Leaders. Appendix: Condensed box scores for all games played that week.
- **Components:** Press Release Header, Rich Text Block, Condensed Data Tables.
- **Mockup filenames:** `DOC-14-weekly-press-release.png`.

### 8.8 Email, notification, and social artifacts

#### COM-01 - Operational email announcement

- **Route and roles:** Email Template | All Recipients.
- **Primary goal and action:** Deliver clear, responsive email communications that render perfectly on desktop and mobile clients.
- **Layout and target viewport:** Responsive HTML Email | 600px Max Width.
- **Main content:** A clean, single-column layout. A solid `color.background.inverse` (Navy/Slate) header containing the League Logo. The message body uses high-contrast text (`color.text.primary` on white). Any primary call-to-action (e.g., "Sign Waiver") uses a bulletproof, full-width HTML button. Footer contains mandatory unsubscribe links and organization address.
- **Components:** Email Header, Rich Text Body, Bulletproof Button, Legal Footer.
- **Mockup filenames:** `COM-01-operational-email.png`.

#### COM-02 - SMS treatment

- **Route and roles:** System Notification (SMS) | All Opted-in Recipients.
- **Primary goal and action:** Deliver urgent alerts clearly within the strict 160-character constraint.
- **Layout and target viewport:** Native OS Message Bubble | Mobile.
- **Main content:** A visual mockup of an iOS/Android text message bubble. Format: " [League Name] ALERT: [Message]. Link: [ShortURL]" (e.g., "Meade Softball ALERT: Field 1 closed due to rain. All 6 PM games delayed. Details: mcl.org/status").
- **Components:** OS Native Message Bubble Mockup.
- **Mockup filenames:** `COM-02-sms-treatment.png`.

#### COM-03 - Push-notification treatment

- **Route and roles:** Native OS Push Notification | App Users.
- **Primary goal and action:** Interrupt the user appropriately with time-sensitive game data or alerts.
- **Layout and target viewport:** Native OS Lockscreen/Banner | Mobile.
- **Main content:** Mockup of an OS-level push notification. Features the League App icon. Title (e.g., "Game Reminder") and concise body text (e.g., "Team Alpha vs Team Beta starts in 1 hour at Field 2.").
- **Components:** OS Native Push Notification Banner.
- **Mockup filenames:** `COM-03-push-notification.png`.

#### COM-04 - In-app urgent alert and acknowledgement

- **Route and roles:** App Modal overlay | All Authenticated Users.
- **Primary goal and action:** Force the user to read and explicitly dismiss an urgent safety or scheduling alert upon opening the app.
- **Layout and target viewport:** Modal Overlay | iOS Phone (393) / Android Phone (412).
- **Main content:** A full-screen or large modal overlay blocking the underlying app interface. A red warning icon, the alert text, and a mandatory "I Understand" primary button that records the acknowledgment timestamp to the database before dismissing.
- **Components:** Blocking Modal, Alert Icon, Button Destructive (Acknowledge).
- **Mockup filenames:** `COM-04-in-app-urgent-alert.png`.

#### COM-05 - Social-media weather or status graphic

- **Route and roles:** Exported Graphic | League Admin (for Facebook/Instagram).
- **Primary goal and action:** Generate a branded, square image that conveys field playability at a glance for social feeds.
- **Layout and target viewport:** Square Graphic | 1080x1080px.
- **Main content:** Large, bold typography over a subtle field/grass background motif. The center prominently displays the Canonical Status (e.g., a massive Emerald "ALL FIELDS OPEN" or Amber "GAMES DELAYED"). Includes a timestamp of the decision.
- **Components:** Square Image Canvas, Giant Status Typography, Watermark/Timestamp.
- **Mockup filenames:** `COM-05-social-status-graphic.png`.

#### COM-06 - Social-media final-game result graphic

- **Route and roles:** Exported Graphic | League Admin.
- **Primary goal and action:** Celebrate game results dynamically on social media.
- **Layout and target viewport:** Square Graphic | 1080x1080px.
- **Main content:** A visually appealing scoreboard graphic. "FINAL SCORE" at the top. Left side shows the Away Team Name and Score. Right side shows the Home Team Name and Score. The winning team's score is visually emphasized (bolded or scaled up slightly).
- **Components:** Square Image Canvas, Split Scoreboard Graphic.
- **Mockup filenames:** `COM-06-social-final-score.png`.

#### COM-07 - Game QR-code flyer or share card

- **Route and roles:** Printed Flyer / Digital Share Card | Public, Coaches.
- **Primary goal and action:** Allow spectators at the park to quickly scan and view the live score or team rosters on their phones.
- **Layout and target viewport:** Portrait Flyer | Print (8.5x11") or Digital Mobile View.
- **Main content:** A massive QR Code dead-center. Above it: "Scan for Live Score & Rosters". Below it: The specific matchup details (Team A vs Team B, Field 1).
- **Components:** Massive QR Code, Clear Call to Action Header.
- **Mockup filenames:** `COM-07-game-qr-flyer.png`.

#### COM-08 - Media-release delivery email

- **Route and roles:** Email Template | Media Subscriptions.
- **Primary goal and action:** Distribute the weekly press release cleanly to local journalists, ensuring formatting remains intact.
- **Layout and target viewport:** Responsive HTML Email | 600px Max Width.
- **Main content:** Similar to COM-01, but the body contains the full text of the DOC-14 press release. Standings tables are formatted using strict HTML `<table>` tags optimized for email clients to prevent visual breakage. Includes a link to download the PDF version.
- **Components:** Email Header, Rich Text Body, HTML Data Tables (Email safe), Download Link.
- **Mockup filenames:** `COM-08-media-release-email.png`.

## 9. Quality confirmations

- [x] Every manifest item has a specification; mockup mappings are retained wherever the source provides them.
- [x] The Modern Field design tokens are locked and applied consistently.
- [x] Major workflows include error, loading, permission, and disconnected-state guidance.
- [x] Game-night actions fit the target phone and tablet viewports without scrolling the scoring pad.
- [x] Critical desktop actions use sticky regions and remain above the fold.
- [x] Public specifications do not expose private minor information.
- [x] Terminology is consistent, including **Official Final**, **Pending Sync**, and **Participant**.
- [x] Adult and guardian-managed waiver flows remain separate and do not truncate legal text.
- [x] Public live pages are read-only.
- [x] The schedule builder exposes hard constraints and fairness measurements.
- [x] AI content remains a draft until a named human approves it.

## 10. Codex UI implementation handoff

1. **Token architecture:** Translate the JSON tokens into CSS custom properties at the root of the web application and into the global React Native theme. Never hardcode status or brand hex values inside feature components.
2. **Typography:** Import Roboto Flex. Map headings to semantic `h1` through `h6` elements with responsive sizing. Use a 16px base body/input size to preserve mobile readability and prevent unwanted browser zoom.
3. **Responsive implementation:** Follow the mobile, tablet, and desktop reflow rules in Section 5. Complex workbenches use bounded internal scrolling, while primary actions remain fixed or sticky.
4. **Component-first delivery:** Implement Top Bar, Side Rail, Bottom Navigation, Sticky-Header Data Table, Segmented Control, Status Badge, Alert Banner, Drawer, Bottom Sheet, and Sticky Action Bar before building individual pages.
5. **Accessibility:** Every semantic status requires visible wording and/or an icon, focus states must remain obvious, and mobile Game Mode targets must meet the 64px scoring minimum.
6. **Requirement precedence:** Treat page text and behavior in this styling guide as illustrative. Validate every implementation against the authoritative League App requirements, especially waivers, minors, permissions, official game state, offline synchronization, communications consent, and AI publication gates.
