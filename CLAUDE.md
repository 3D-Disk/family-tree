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
- Planned: React Flow (`@xyflow/react`) for the canvas, Dexie for IndexedDB,
  JSZip for the save file.
- Folders: `src/components/` UI, `src/model/` types + relationship maths + dates,
  `src/layout/` tree layout, `src/db/` IndexedDB, `src/storage/` save files.

## Commands
- `npm run dev`: local dev server
- `npm run lint`: oxlint
- `npm test`: vitest
- `npm run build`: typecheck + production build to `dist/`

Run lint, test and build before every push.

## Roadmap
1. Foundation (shell, deploy). **Done.**
2. People + saving (form, photos, placeholders, .familytree save/open, auto-save recovery)
3. Relationships + derived relatives
4. Tree visualization (Default view)
5. Details side panel (Summary, Biography, Photo Gallery, Relatives, Events,
   Burial Location, Notable Details, Links)
6. No Relations tray, search, focus-on-person
7. New Person Questionnaire (wizard)
8. Views (drag to reorder, save/select)
9. Free-placement toggle for views
10. Later: GEDCOM, sharing/accounts, print/export image
