# Family Tree — project notes for Claude

## About the owner
The owner does not code and relies entirely on Claude. Explain changes in plain
English, keep each step small and reviewable, and ask before big design choices.

## What this is
A personal family-tree website. Each person is a **node / tree card**. Clicking a
card opens a **details side panel** (slides in from the right; can expand to full
screen). Single user for now; sharing/accounts are a future phase.

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
- Dexie (IndexedDB auto-save), JSZip (save file). Planned: React Flow
  (`@xyflow/react`) for the tree canvas.
- Folders:
  - `src/model/`: types, date parsing (`dates.ts`), person helpers
  - `src/state/`: `treeReducer.ts` (all edits go through it; bumps `revision`
    and sets `dirty`), `TreeProvider.tsx` (save/open/auto-save/notices),
    `useTree()` hook in `treeContext.ts`
  - `src/storage/`: `fileFormat.ts` (.familytree zip, versioned; add defaults
    for new fields in `readTreeFile` so old files keep opening),
    `fileAccess.ts` (pickers/download), `autosave.ts` (Dexie), `images.ts`
  - `src/components/`: UI. `PeopleBoard` is a temporary grid until the tree view.
    `ConfirmDialog` is the shared pop-up (use it instead of `window.confirm` for
    new prompts). `PhotoAdjuster` frames profile photos.
- Profile photos: the original (≤1600px) is `photoId`; the framing is
  `photoCrop` (`src/model/photoCrop.ts`); a 256px framed square is `avatarId`
  and is what cards show (`cardPhoto()`). Keep all three in sync via the
  reducer's `PhotoUpdate`.
- The side panel form reports unsaved edits to `App.tsx`; every way of leaving
  the form goes through `requestLeave()` so the "Save changes?" pop-up shows.
  - Planned: `src/layout/` for tree layout.
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
3. Relationships + derived relatives
4. Tree visualization (Default view)
5. Details side panel (Summary, Biography, Photo Gallery, Relatives, Events,
   Burial Location, Notable Details, Links)
6. No Relations tray, search, focus-on-person
7. New Person Questionnaire (wizard)
8. Views (drag to reorder, save/select)
9. Free-placement toggle for views
10. Later: GEDCOM, sharing/accounts, print/export image
