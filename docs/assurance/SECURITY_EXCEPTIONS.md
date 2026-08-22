# Security exceptions

Security exceptions are narrow, temporary, and fail closed at their recorded UTC expiry. They do
not change the default requirement that every other fixable High or Critical dependency or
container finding is blocking.

## SEC-EXC-001 — Metro image-size parser denial of service

- **Advisories:** `GHSA-w3rx-r6r6-pgpr` (`CVE-2025-71330`) and
  `GHSA-5p2g-fcmc-qvqq` (`CVE-2025-71329`). No other advisory is included.
- **Dependency path:** `@league/mobile` → Expo or React Native → `metro@0.84.4` →
  `image-size@1.2.1`. One representative audit path is
  `apps__mobile>expo>@expo/cli>@expo/metro>metro>image-size`.
- **Reachability:** Build-time and local-development tooling only. Metro reads repository-controlled
  mobile assets while creating a bundle; deployed API, web, worker, scheduler, and mobile runtime
  request paths do not invoke Metro or pass customer uploads to `image-size`.
- **Risk:** A deliberately malformed ICNS, JXL, or HEIF repository asset could block the Node.js
  bundler event loop.
- **Owner:** Repository owner.
- **Approval date:** 2026-08-21.
- **Expiry:** 2026-09-15. The exception no longer applies on this UTC date; CI fails closed and runs
  the audit with no accepted advisories.
- **Compensating controls:** Mobile assets are repository-controlled and reviewed; untrusted or
  customer-supplied images do not enter the Metro asset pipeline; ICNS, JXL, and HEIF assets must not
  be added while this exception is active; CI installs the frozen lockfile with pinned Node and pnpm;
  all other High and Critical JavaScript findings remain blocking; Python audits and fixable
  High/Critical container scans remain blocking.
- **Removal trigger:** Remove both advisory IDs from the repository-owned audit policy and remove
  this exception at the earlier of (a) a supported Metro dependency path resolving a non-vulnerable
  `image-size`, (b) an upstream or reviewed local patch that eliminates both parser loops, or (c) the
  expiry date. Regenerate the frozen lockfile and pass dependency audit, mobile tests, mobile export,
  and container security checks before removal is considered complete.

At approval time the supported Metro dependency path still declared the vulnerable `image-size` 1.x
range and did not resolve to the patched 2.x release. The audit runs without pnpm ignore
configuration or mutating `--ignore` flags; a broad `--ignore-unfixable` policy is explicitly
prohibited.

## SEC-EXC-002 — Development-only object storage and mail-capture images

- **Images and services:**
  `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`
  (`minio`),
  `minio/mc:RELEASE.2025-08-13T08-35-41Z@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727`
  (`minio-init`), and
  `axllent/mailpit:v1.30.7@sha256:d5ecbb067db3705fa953d79e1b7f81ef84038df67aba6c52825d8c02a1ea748a`
  (`mailpit`). No other image or service is included.
- **Reachability:** These services provide local object-storage emulation, one-shot bucket setup,
  and local email capture. They are not part of the hosted-beta topology and must not be exposed to
  the public internet or used with customer data.
- **Risk:** At approval time the pinned images reported 140 fixable High and 6 fixable Critical
  findings in total: MinIO server 88 High/4 Critical, MinIO client 42 High/2 Critical, and Mailpit
  10 High/0 Critical. The application, gateway, PostgreSQL, and Redis images remain subject to the
  blocking container gate without this exception.
- **Owner:** Repository owner.
- **Approval date:** 2026-08-21.
- **Expiry:** 2026-09-15. The exception no longer applies on this UTC date; CI fails closed and
  treats findings in all three images as blocking.
- **Compensating controls:** Compose binds interactive MinIO and Mailpit ports to loopback, keeps
  service traffic on private Docker networks, uses only synthetic development and test data, and
  runs `minio-init` as a short-lived setup task. A hosted beta must use separately secured managed
  object storage and transactional email services and must not deploy any of these three images.
  CI continues to scan the exception images in report-only mode so their findings remain visible.
- **Removal trigger:** Replace MinIO with a supported hardened build or managed S3-compatible
  service and update or rebuild Mailpit with patched dependencies. Remove the service from the
  exception as soon as its image passes the fixable High/Critical scan, and remove the entire
  exception no later than its expiry.
