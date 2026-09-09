# Myoc Excalidraw Release Notes

## IMPORTANT

RUN LOGIN BEFORE DOING ANY RELEASE STUFF

This file documents the release workflow for the Myoc fork of Excalidraw.

It is intended for:

- humans working in this repo
- agents making changes or preparing releases

## Scope

This fork publishes packages under the `@myoc` scope.

Important:

- this repo is released from the workspace root
- do not publish `packages/excalidraw` directly with `yarn publish`
- the root release script exists to build packages in order and keep package versions aligned

## Package Relationships

The main package depends on internal workspace packages:

- `@myoc/common`
- `@myoc/math`
- `@myoc/element`
- `@myoc/excalidraw`

These must stay version-aligned for release.

## Normal Workflow

From the repo root:

```powershell
cd D:\Code\myoc\excalidraw
yarn install
yarn build:packages
```

If both succeed, the workspace is in a releasable state.

## Release Workflow

Always run releases from the repo root:

```powershell
cd D:\Code\myoc\excalidraw
```

Internal/test releases:

```powershell
yarn release --tag=test
```

Rolling internal releases:

```powershell
yarn release --tag=next
```

Stable release:

```powershell
yarn release --tag=latest --version=0.19.519
```

What the root release script does:

- runs install
- clears build output
- builds `common`, `math`, `element`, then `excalidraw`
- updates internal package versions for the release
- publishes packages in dependency order
- restores local dependency declarations after publishing

## Do Not Do This

Do not run this from `packages/excalidraw`:

```powershell
yarn publish
```

Why:

- it skips the monorepo release flow
- it does not align internal package versions correctly
- it can publish `@myoc/excalidraw` while `@myoc/common`, `@myoc/math`, and `@myoc/element` are still on older versions

## Changelog Prompt

During `yarn release --tag=latest`, the script may print:

- `Bad commits: [...]`

For this fork, that is usually not important.

Reason:

- the changelog generator expects upstream-style PR commit messages
- Myoc often uses direct commits without upstream PR numbers

If the release is internal, this warning can usually be ignored.

## npm Scope Requirement

Publishing only works if the logged-in npm user has publish access to the `@myoc` scope.

If publish fails with a registry `404` for `@myoc/excalidraw`, check:

- the npm account is logged in correctly
- the account can publish to `@myoc`
- `@myoc` is the intended scope

## Known Repo Notes

- This fork removes or disables AI-specific behavior. If compile errors appear around `aiEnabled`, prefer removing that dependency instead of restoring upstream AI features.
- The browser example in `examples/with-script-in-browser` should use `@myoc/excalidraw`, not `@excalidraw/excalidraw`.
- Internal workspace dependencies must match the version being released.

## Fork UI Policy For Upstream Merges

Preserve these Myoc UI removals when merging upstream Excalidraw:

- Take ordinary upstream editor changes, but keep Myoc's policy removals: AI/generative behavior, Mermaid/TTD, command palette, and built-in library/publishing surfaces should stay unavailable unless intentionally reintroduced.
- These removals can span actions, types, app state, exports, locales, tests, and UI wiring. Do not rely on removing only the visible import or button.
- Keep zen mode unavailable. Do not restore `actionToggleZenMode`, a main-menu/preferences/context-menu toggle, the `Alt+Z` shortcut, or a public `zenModeEnabled` prop. Restored/imported `appState.zenModeEnabled` should stay forced to `false`.
- Keep omitted right-click context-menu items omitted: `copyAsPng`, `copyAsSvg`, `copyText`, `copyStyles`, and `pasteStyles`.
- Keep the host image context-menu hook working. `imageContextMenuItems` should receive all selected image ids for all-image selections, the clicked image id for grouped or mixed selections, and should render after `cut` / `copy` / `paste` with a divider above the host image items.
- Keep Myoc image layout actions available for multi-image selections: `arrangeElements` and `normaliseElements` should appear in the image right-click context menu and in the selected-element actions island, alongside selection-level Smart Zoom.
- Keep the app example's simple image right-click `Alert ID` item so this behavior is easy to verify manually.
- Preserve the Myoc simplified toolbar shape after upstream toolbar merges:
  - main toolbar tools are selection/lasso selector, freedraw, text, stroke eyedropper, image, and eraser
  - draw-to-shape belongs in the more-tools menu above rectangle, diamond, ellipse, arrow, and line
  - snap-to-objects remains a top-level magnet button to the right of the more-tools menu
  - lock active tool belongs in the more-tools menu
  - smart zoom remains visible in the lower-left controls
  - mobile bottom toolbar controls should stay anchored to the left screen inset, not centered in the viewport
- Preserve Myoc view-mode controls: `viewModeOnly` must force view mode and hide/disable the view-mode toggle, mobile view mode must not add a separate top-right pencil edit button, and the existing lower-left view-mode toggle should show the pencil icon while currently in view mode. Pasting or dropping images while in view mode should be allowed for non-`viewModeOnly` editors by default by leaving view mode and inserting the image; hosts can opt into rejection via `viewModeImageInsertBehavior="reject"` and handle `onViewModeImageInsertRejected`.
- Preserve Myoc shortcut policy:
  - number keys `1` through `0`, including shifted number combinations, are reserved for Myoc/Floref and must not select drawing tools or trigger zoom-to-fit actions
  - `P` selects pen/freedraw
  - `X` selects draw-to-shape without Shift
  - `B` must not activate bucket/background fill
  - `K` must not activate laser
  - `I` opens the stroke eyedropper
  - `Shift+I` opens the background eyedropper
  - `Shift+G` must not open the background eyedropper
  - `Alt+S` toggles snap-to-objects
  - `Q` toggles lock active tool
  - `wheelZoomsOnDefault` should make plain mousewheel zoom by default, including while the eyedropper is active
- Preserve Myoc alignment behavior: the shared Stacking editor preference defaults off, so left/right/top/bottom alignment compacts selected groups without bounding-box overlap using the Arrange gap; enabling Stacking restores exact-edge overlap, while center alignment remains unchanged.
- Label tests that protect fork-specific toolbar or shortcut behavior with `MyOC regression:` so future upstream merges do not mistake them for generic upstream expectations.

Merge validation rules:

- Do not treat a conflict-free tree as mergeable by itself. Whole-file resolutions in central contracts like `packages/excalidraw/types.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/index.tsx`, `packages/excalidraw/appState.ts`, and element types can silently combine callers from one branch with contracts from the other.
- Before choosing upstream or fork behavior for disputed symbols, verify ownership with history, for example `git log -S<symbol>` plus ancestry checks. Myoc-owned image placeholder/compression behavior, including `thumbHash` / blur / smooth-blur APIs from commit `9ab00a057`, should be preserved unless proven obsolete.
- Before committing or publishing a merge, run `yarn workspace @myoc/excalidraw gen:types`. This validates the package declarations at `dist/types/excalidraw/index.d.ts`; if it fails, the checkout is not safe for future builds even if existing published consumers are unaffected.

## Before Finishing a Release

Check:

```powershell
yarn build:packages
```

If `yarn.lock` was regenerated or had previous merge conflicts, make sure it is staged before committing:

```powershell
git add yarn.lock
```

## Quick Checklist

- run commands from repo root
- use `yarn install`
- use `yarn build:packages`
- use `yarn release --tag=test|next|latest`
- do not use direct `yarn publish` in `packages/excalidraw`
- keep all `@myoc/*` package versions aligned
- ignore `Bad commits` unless changelog quality matters for the release
