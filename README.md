# IELTS Practice

A private, single-user IELTS computer-delivered mock test app: Listening, Reading, Writing and
Speaking with exam-accurate timers, instant scoring and AI writing feedback. It's a static React
app on Firebase Hosting and Firestore, on the free Spark plan.

- **Spec:** [docs/SPEC.md](docs/SPEC.md), built in phases (section 10)
- **Design:** the [canvas](https://claude.ai/artifact/ADeMvfJhekj5tK7s91Ph2D), with artboard sources
  in [docs/design](docs/design)
- **First-time setup** (Firebase project, owner UID, GitHub secrets):
  [docs/SETUP.md](docs/SETUP.md)
- **Rules for Claude Code:** [CLAUDE.md](CLAUDE.md)

## Commands

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Start the dev server (needs `.env.local`, see SETUP)          |
| `npm run build`     | Type-check and build to `dist/`                               |
| `npm test`          | Unit tests (Vitest)                                           |
| `npm run test:e2e`  | End-to-end tests (Playwright, desktop and 390 px)             |
| `npm run lint`      | ESLint and Prettier check (`npm run format` fixes formatting) |
| `npm run typecheck` | TypeScript only                                               |
| `npm run validate`  | Check `content/` against the schemas and publishing rules     |
| `npm run media`     | Hash and convert new files in `public/media` (needs ffmpeg)   |
| `npm run seed`      | Publish `content/` to Firestore (your laptop only, see SETUP) |

Pushing to `main` runs every check and deploys; each pull request gets a preview URL.
