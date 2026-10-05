# Family Tree — project notes for Claude

## About the owner
The owner does not code and relies entirely on Claude. Explain changes in plain
English, keep each step small and reviewable, and ask before big design choices.

## What this is
A personal family-tree website. Each person is a **node / tree card**. Clicking a
card opens a **details side panel** (slides in from the right; can expand to full
screen) showing a read-only Details view (`PersonDetails`); its Edit button
switches to the form (`PersonForm`). Saving or cancelling returns to Details.
Single user for now; sharing/accounts are a future phase.

## Hard rules
- **No family data ever leaves the user's computer.** No servers, no cloud APIs,
  no analytics. Family data never goes in the repo.
- Data is saved to a `.familytree` file (zip of JSON + photos) via Save / Save As /
  Open, using the File System Access API in Chrome/Edge with a download fallback
  elsewhere. The browser (IndexedDB) keeps an auto-save copy only as a safety net.
- Store only two relationship types: **parent→child** (biological, adoptive, step,
  foster, guardian) and **partnership** (married, engaged, partner, divorced,
  separated, widowed; with dates). Siblings, cousins, aunts/uncles, in-laws etc.
  are always *derived*, never stored.
- Dates may be partial or approximate ("1890", "Mar 1890", "abt. 1890").
  Display style: `1/1/2000 (Manhattan, NY, USA)`.

## Layout rules (Default view)
- Generations are rows. Siblings ordered oldest → youngest, left → right;
  unknown birth dates go last in the order added.
- Couples: male left, female right; same-sex couples older on the left.
  A person with several partners sits between them: earlier partner left,
  later partner right.
- Custom **Views** store reorderings (sibling order, couple side; later an
  optional free-placement mode), not frozen pictures. The Default view is
  read-only.

## Tech
- React + TypeScript + Vite; static site deployed to GitHub Pages from `main`
  via `.github/workflows/deploy.yml`. `base: './'` in `vite.config.ts`.
- Dexie (IndexedDB auto-save), JSZip (save file), React Flow (`@xyflow/react`)
  for the tree canvas (pan/zoom/minimap; cards drag sideways only, to edit views).
- Folders:
  - `src/model/`: types, date parsing (`dates.ts`), person helpers,
    `relationships.ts` (lookups, rules like "no loops / max 2 biological
    parents", and pure edit functions), `relatives.ts` (derived relatives with
    gendered labels), `filters.ts` (search + People-list filters; add a
    filter as one entry in `FILTERS`), `details.ts` (age, Summary rows, life
    timeline, safe links for the Details view), `focus.ts` ("Focus on tree":
    ancestors/descendants within N generations + partners + siblings, and
    `subFamily` to cut the family down before layout). `testFamily.ts` builds made-up
    families for tests.
  - `src/state/`: `treeReducer.ts` (all edits go through it; bumps `revision`
    and sets `dirty`), `TreeProvider.tsx` (save/open/auto-save/notices),
    `useTree()` hook in `treeContext.ts`
  - `src/storage/`: `fileFormat.ts` (.familytree zip, versioned; add defaults
    for new fields in `readTreeFile` so old files keep opening),
    `fileAccess.ts` (pickers/download), `autosave.ts` (Dexie), `images.ts`
  - `src/layout/familyLayout.ts`: pure Default-view layout (generations →
    partner "chains" per row → sibling groups ordered under parents via
    barycentre sweeps → x positions by alternating least-squares passes
    (`isotonicPlace`) → lines). Returns card positions + line polylines.
    `layoutFamily(f, L, view)` takes a view's `siblingOrder` / `chainOrder`
    and applies them with `applyOrder` (listed people take the same slots in
    the saved order; people added later keep their default spot). It also
    returns `chains` and `siblingGroups` so `layout/viewEdits.ts`
    (`reorderByDrop`) can turn a sideways drag into a new order.
  - `src/components/tree/`: `TreeView` renders the layout with React Flow
    (cards = nodes, all lines = one SVG node behind them); `TreeCard` has the
    hover "+ Parent/Partner/Child/Sibling" buttons, which open the person's
    panel with that Family picker already open (`addRequest`).
  - `src/components/`: other UI.
    `ConfirmDialog` is the shared pop-up (use it instead of `window.confirm` for
    new prompts). `PhotoAdjuster` frames profile photos.
- Person details: `biography`, `events` (typed Life events: residence,
  immigration, occupation… — the Summary derives "Lived in", "Immigration",
  "Occupation" from them), `burial`, `notable` (list), `links` (only http(s)
  is ever rendered as a link; see `safeUrl`). Editors live in
  `components/edit/DetailEditors.tsx`.
- Profile photos: the original (≤1600px) is `photoId`; the framing is
  `photoCrop` (`src/model/photoCrop.ts`); a 256px framed square is `avatarId`
  and is what cards show (`cardPhoto()`). Keep all three in sync via the
  reducer's `PhotoUpdate`.
- Gallery: `Person.gallery` entries point at a full image (`photoId`) and a
  320px thumbnail (`thumbId`) in the photo store. New images go to the
  reducer via `savePerson`'s `newPhotos`; on every save the reducer drops any
  image the person no longer uses (`photoIdsOf`). Never share a photo id
  between people or between profile and gallery ("Make profile photo" copies).
- `PhotoViewer` takes a list of photos (arrows/← → keys, captions, counter).
- Deleting a person goes through `DeletePersonButton` (Details and form).
- The fallback file picker (Safari/iPhone/Firefox) has no `accept` filter on
  purpose: iOS greys out unknown types like `.familytree`. `readTreeFile`
  validates instead.
- Life events in the edit form are grouped by type and collapsible
  (`EventsEditor`); collapse state is UI-only, never saved.
- Views: `TreeData.views` (saved in the file; `normalizeTree` cleans them).
  The selected view is UI state in `App.tsx` and resets when a file is
  opened. Header select = Default / saved views / New / Rename / Delete;
  `ViewBar` (with Reset) shows above the tree in a saved view. Dragging in
  Default offers "Save as a new view?" (`PromptDialog`).
- Family links are edited in `components/family/FamilySection.tsx` inside the
  person form, on a draft copy of the family; `savePerson` with `family`
  commits the person and links together. Adding a sibling to someone with no
  parents creates an "Unknown parent" person to connect them. When adding a
  partner/parent/child, `RelativePicker` offers tick-boxes (`extrasFor`), e.g.
  "Also make them a parent of: ☑ Ann" for children with fewer than two parents.
- `PeopleList` (left) shows search/filter results and stays open while a
  person is edited in the side panel (right). Non-matching cards are dimmed.
- The side panel form reports unsaved edits to `App.tsx`; every way of leaving
  the form goes through `requestLeave()` so the "Save changes?" pop-up shows.
- End-to-end checks are run ad hoc with Playwright against `npm run preview`.

## Commands
- `npm run dev`: local dev server
- `npm run lint`: oxlint
- `npm test`: vitest
- `npm run build`: typecheck + production build to `dist/`

Run lint, test and build before every push.

## Roadmap
1. Foundation (shell, deploy). **Done.**
2. People + saving (form, photos, placeholders, .familytree save/open, auto-save recovery). **Done.**
3. Relationships + derived relatives. **Done.**
4. Tree visualization (Default view). **Done.**
5. Details side panel: Summary, Biography, Photos (gallery), Relatives, Life
   events, Burial, Notable details, Links. **Done.**
6. No Relations tray + search (**done**, as filters in the People list);
   focus-on-person (**done**: "Focus on tree" in Details + bar with
   generations up/down and "Show everyone")
7. ~~New Person Questionnaire (wizard)~~ Skipped at the owner's request.
   Instead: side panel back / forward buttons (`src/state/panelHistory.ts`,
   browser-style history of the last 50 people opened). **Done.**
8. Views (drag sideways to reorder siblings / couple sides, save, switch,
   rename, delete, reset). **Done.**
9. Free-placement toggle for views
10. Later: GEDCOM, sharing/accounts, print/export image
