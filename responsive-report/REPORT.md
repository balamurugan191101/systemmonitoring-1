# Responsive audit and fix report

**Project:** Storage Monitor Dashboard  
**Audit date:** 2026-10-30  
**Scope:** Angular login, guarded dashboard routes, global styles, and standalone `workflow-overview.html`.

## Summary

Added shared Sass breakpoints at 480px and 760px, responsive login and dashboard adjustments, 44px mobile control targets, visible keyboard focus, and a compact mobile workflow summary. The detailed swimlane SVG remains available from the workflow page’s Download SVG control and in print/PDF output.

At all 11 tested viewport sizes, the captured pages had no document-level horizontal overflow. The workflow diagram itself is intentionally wide on desktop; on screens up to 760px it is replaced by the readable summary, avoiding a clipped/pan-only mobile chart.

## Before and after captures

Each directory contains PNGs for the four page entries at the viewport matrix below; `layout-measurements.json` records the viewport and document widths. `capture.cjs` documents how to reproduce the captures.

- [Before screenshots](before/)
- [After screenshots](after/)
- [Capture script](capture.cjs)
- Mobile workflow example: [before 320×844](before/workflow-overview-320x844.png) → [after 320×844](after/workflow-overview-320x844.png)
- Login example: [before 320×844](before/login-320x844.png) → [after 320×844](after/login-320x844.png)

The requested viewports were 320×844, 375×844, 414×844, 600×844, 768×900, 1024×900, 1280×1000, 1440×1000, 1920×1000, 667×375 landscape, and 1024×768 landscape. The before directory contains 45 PNGs (one extra capture); the after directory contains 44 PNGs (4 pages × 11 sizes).

**Capture limitation:** Dashboard and forbidden URLs require authentication/authorization. The isolated browser had no signed-in session, so the guards redirected those routes to login. After the code changes, the headless Angular screenshots remained on the “Loading secure session…” shell, even though `/api/auth/csrf` and `/api/auth/me` responded successfully to direct local requests. Treat Angular after screenshots as route/layout measurements, not a visual verification of the signed-in dashboard. The standalone workflow page rendered in the captures.

## Responsive rules and locations

| File | Responsive styles / role |
|---|---|
| `src/_breakpoints.scss` | Shared Sass mixins: small ≤480px; mobile ≤760px. |
| `src/app/auth/login.component.scss` | Single-column login through 760px, compact spacing ≤480px, short landscape layout, reduced-motion preference, 44px actions, larger mobile form text, visible focus. |
| `src/app/dashboard/dashboard.scss` | Wraps dashboard header/account; flexible filters and full-width inputs; 44px controls; single-column cards/drives at ≤480px; wrapping pager. Existing table retains its contained horizontal scroll for wide columns. |
| `src/styles.css` | Shared 44px tap-target token and small-viewport height fallback. |
| `workflow-overview.html` | ≤760px swaps the large SVG for a compact ordered workflow; ≤480px stacks controls; print restores the detailed SVG. |

### Breakpoint cheat sheet

| Name | Width | Use |
|---|---:|---|
| Small | 480px and below | One-column card/filter layouts and tighter page padding. |
| Mobile | 760px and below | Mobile login/dashboard controls and workflow summary instead of wide swimlane SVG. |

The standalone workflow HTML duplicates these two pixel values because it is opened directly and cannot import the Angular Sass module.

## Findings and fixes

| Page / issue | Before | Change |
|---|---|---|
| Workflow overview at phone widths | SVG had a 1050px minimum width inside a scroll container, making the detailed diagram impractical on a narrow screen; controls had small default hit areas. | Show a five-stage summary on narrow screens, keep full SVG download and printable version, and size controls to at least 44px. |
| Login controls and small text on mobile | Several actions and the show-password control were smaller than a comfortable touch target; secondary labels were small. | Increased mobile touch areas and form text; added keyboard focus indication and short-landscape treatment. |
| Dashboard controls/cards | Filters and account row could be cramped; touch inputs and sort/pager controls were compact; drive rules were duplicated. | Added mobile wrapping, full-width touch inputs, compact single-column cards, pager wrapping, and removed duplicate drive styles. |
| General mobile sizing | Viewport metadata was present; short viewport height fallback was incomplete. | Added `100svh` fallback where used and a shared touch-target token. |

## Edge cases and remaining issues

- Dashboard and forbidden pages need an authenticated browser session for real visual inspection. This audit did not create or use credentials.
- The file table remains horizontally scrollable inside its own bounded container when columns do not fit; the page itself does not overflow horizontally.
- `src/app/app.css` contains a dark-mode media query but is not referenced by the current Angular component or global styles configuration. It was left untouched because it is not active styling.
- `workflow-overview.html` is independent of Angular and maintains its own matching 480px/760px breakpoints.
- Build succeeds but reports that login component SCSS is 306 bytes over Angular’s 5.00 kB component-style budget (5.31 kB). No lint script is configured in `package.json`.
- No additional product breakpoints, content changes, or role-specific layout rules were inferred.

## Verification

- `npm.cmd run build` — passed. Angular reported the component style budget warning above.
- `npm.cmd run test:api` — passed, 5 tests.
- `npm.cmd test -- --watch=false` — passed, 2 tests.
- `python -m unittest tests.test_monitor` — passed, 2 tests.
- Headless Edge capture helper — 44 after PNGs produced; all 44 measured pages had document widths within their requested viewport widths, both before and after.


