# IELTS Practice Platform

Personal IELTS computer-delivered mock test app. One user. Full spec: docs/SPEC.md.
Design canvas (source of truth for UI): https://claude.ai/artifact/ADeMvfJhekj5tK7s91Ph2D
A copy of every artboard's source is in docs/design/ (see docs/design/README.md).

## Stack

Vite + React + TypeScript (strict), Tailwind (tokens in src/styles/tokens.css), Zustand,
Zod, Firebase JS SDK (auth, firestore, AI Logic), lucide-react, Vitest, Playwright.
Hosting: Firebase Hosting (Spark plan) via GitHub Actions. Repo is private.

## Commands

npm run dev | build | test | test:e2e | lint | typecheck | validate | media | seed

## Hard rules

- Free Spark plan only: no Cloud Functions, no Cloud Storage, no paid APIs.
  Media lives in public/media and ships with the deploy (see SPEC section 8).
- All scoring, band, timer and matching logic goes in src/engine as pure functions with unit tests.
- Every Firestore read/write goes through src/lib/db.ts. Validate with Zod at the boundary.
- Never commit secrets, service-account keys or .env files.
- Never make the repo, test content or media public.
- Colours, fonts and radii come from tokens only. No hard-coded hex values in components.
- Accessibility: 44px targets, real buttons/inputs/labels, aria-label on icon buttons,
  aria-pressed on toggles, states never shown by colour alone.
- Every page must work at 390px wide.

## Conventions

- Components: PascalCase files, one component per file, props typed.
- Question number keys are strings in answers maps ("21").
- Times are seconds (number) in data, m:ss only in the UI.
- Commit messages: "phase-N: <what>".

## Working style

- Start each phase with a short plan and wait for approval.
- Small commits. Run lint, typecheck and tests before saying a task is done.
- If the spec is unclear, ask; if you must assume, write the assumption in your summary.
