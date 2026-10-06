# IELTS Practice Platform: Build Specification

Oct 6, 2026 · @Cartup

## 1. Overview

A personal, zero-cost IELTS computer-delivered mock test app with four modules, exam-accurate
timers, instant scoring, AI writing feedback and an admin panel for entering test content. It runs
on a private GitHub repo plus the free Firebase Spark plan.

**Users.** One person, signed in with Google. The same account is the student and the admin.

**Goals**

- Feel like the real computer-delivered test: split-screen Reading, Listening audio that plays
  once in Full mock, a 1–40 question grid, flags and a countdown timer.
- Help practice in Single part mode: show answers with their location highlighted in the passage
  or audioscript, audioscript follow-along, a highlighter and notes.
- Score instantly: raw score to band for Listening and Reading, an AI band estimate for Writing,
  self-assessment for Speaking.
- Track progress: history, band breakdown with a what-if calculator, and vocabulary with Bangla
  meanings and daily spaced review.
- Cost nothing to run.

**Non-goals:** other users, payments, public hosting of test content, server-side code, official
scores.

**Design source of truth.** Every screen below is drawn on the design canvas:
[IELTS Practice Platform UI](https://claude.ai/artifact/ADeMvfJhekj5tK7s91Ph2D). Each artboard has
working sample interactions; match its layout, states and copy. Section 6 maps routes to
artboards. (A copy of each artboard's source is in `docs/design/`.)

## 2. Architecture

The app is a static React single-page app. Code lives in a private GitHub repo, GitHub Actions
deploys it to Firebase Hosting, and all data lives in Firestore behind Google sign-in. There is no
server code.

**The browser talks only to Firebase; GitHub Actions ships the code** (architecture · 7 parts, no
server code):

```text
Your laptop ──push──▶ GitHub, private repo ──deploy──▶ Firebase Hosting
(Claude Code,          (code, content, media, CI)       (app, audio, images)
 npm run seed)                                                │
                                                 loads app and media
                                                              ▼
                                Browser app (PWA): React app + offline cache
                                 │ sign in          │ read and write        │ essay feedback
                                 ▼                  ▼                       ▼
                         Firebase Auth       Cloud Firestore         Firebase AI Logic
                     (Google sign-in, one   (tests, attempts,      (Gemini writing feedback)
                            UID)                 vocab)
```

Pushes to `main` deploy through GitHub Actions; after that the app reads and writes Firebase
directly, with no server in between.

| Part                       | Role                                                                                                    | Free-tier limit (Spark)                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GitHub (private repo)      | Source code, test content JSON, audio and image files, CI                                               | Actions: 2,000 min/month on private repos                                    |
| GitHub Actions             | Build, test and deploy on every push to `main`; preview URL per pull request                            | Same as above                                                                |
| Firebase Hosting           | Serves the app, audio (`/media/audio/*.mp3`) and images                                                 | 10 GB stored, 360 MB/day transfer                                            |
| Firebase Auth              | Google sign-in, one allowed account                                                                     | Free for Google sign-in                                                      |
| Cloud Firestore            | Published tests, attempts, vocabulary, settings, sync across devices                                    | 1 GiB stored, 50K reads, 20K writes, 20K deletes per day; 1 MiB per document |
| Firebase AI Logic (Gemini) | Writing feedback, called from the browser                                                               | Free tier quota; confirm before building (section 13)                        |
| Browser storage            | Live timer and answers (localStorage), speaking recordings and cached audio (IndexedDB, service worker) | Device storage                                                               |

**Hard constraints from the free plan**

- **No Cloud Storage.** Since 3 February 2026 Cloud Storage for Firebase needs the paid Blaze
  plan, so audio and images ship inside the repo and are served by Hosting.
- **No Cloud Functions.** Scoring, band conversion and validation all run in the browser.
- **No uploads from the browser to Hosting.** Hosting only changes on deploy, so new media files
  are added to the repo (section 8 explains the workflow).
- **GitHub Pages is not used.** It is free only for public repos, and the test content must stay
  private.

**Privacy.** Firestore rules allow only your user ID. Hosting files are public to anyone who knows
the exact URL, so media file names carry a content hash and every response sends
`X-Robots-Tag: noindex`.

## 3. Tech stack and repository

Use React with TypeScript on Vite, Tailwind for the design tokens, and the modular Firebase SDK.
Pin exact versions in `package.json` when the project is created.

| Concern    | Choice                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Build      | Vite, React 18+, TypeScript (strict)                                                             |
| Routing    | React Router, browser history (Hosting rewrites every path to `index.html`)                      |
| Styling    | Tailwind CSS with the tokens in section 9; no other UI kit                                       |
| State      | Zustand store per exam session; React Query or plain hooks for Firestore reads                   |
| Validation | Zod schemas for test content, attempts and vocabulary (shared by app, admin and scripts)         |
| Firebase   | `firebase` JS SDK: `auth`, `firestore` (with offline persistence), AI Logic for Writing feedback |
| Icons      | `lucide-react`                                                                                   |
| Fonts      | IBM Plex Sans, IBM Plex Mono, Source Serif 4, Hind Siliguri (Bangla)                             |
| Offline    | `vite-plugin-pwa` to cache the app shell and audio                                               |
| Tests      | Vitest + Testing Library for units; Playwright for end-to-end                                    |
| Lint       | ESLint + Prettier                                                                                |

**Repository layout**

```text
ielts-practice/
├─ CLAUDE.md                     rules for Claude Code (section 12)
├─ docs/SPEC.md                  this document, exported as Markdown
├─ content/
│  ├─ tests/book21-test1.json    one file per test, matches the Zod schema
│  └─ vocab/seed.json
├─ public/media/
│  ├─ audio/                     b21t1-p1.<hash>.mp3 (64 kbps mono)
│  └─ img/                       b21t1-w1.<hash>.png
├─ scripts/
│  ├─ validate-content.ts        runs the schema + checks in section 8
│  ├─ hash-media.ts              renames media with a content hash, writes media-manifest.json
│  └─ seed.ts                    pushes content/*.json to Firestore (Admin SDK, run locally)
├─ src/
│  ├─ main.tsx, App.tsx, routes.tsx
│  ├─ lib/                       firebase.ts, auth.ts, db.ts, ai.ts, storage.ts (IndexedDB)
│  ├─ schema/                    test.ts, attempt.ts, vocab.ts
│  ├─ engine/                    timer.ts, answers.ts, scoring.ts, bands.ts, srs.ts
│  ├─ store/                     examStore.ts
│  ├─ components/
│  │  ├─ exam/                   ExamHeader, QuestionGrid, SectionNav, PausedOverlay, NotesPopover
│  │  ├─ reading/                PassagePanel, HighlightedText
│  │  ├─ listening/              AudioPlayer, Audioscript
│  │  └─ questions/              one component per question type
│  ├─ pages/                     Dashboard, Library, Reading, Listening, Writing, Speaking,
│  │                             Results, History, Bands, Vocabulary, admin/*
│  └─ styles/tokens.css
├─ tests/                        unit/ and e2e/
├─ firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
└─ .github/workflows/            ci.yml, deploy.yml
```

## 4. Data model

Test content is authored as JSON in `content/tests/`, validated by Zod, and published to
Firestore. Each Reading passage, Listening part, Writing task set and Speaking set is its own
document, so no document comes near the 1 MiB limit.

**Firestore collections**

| Path                                  | Holds                                                                      | Written by         |
| ------------------------------------- | -------------------------------------------------------------------------- | ------------------ |
| `tests/{testId}`                      | Test metadata: book, number, track, timing, status (`draft`, `live`)       | Admin, seed script |
| `tests/{testId}/sections/{sectionId}` | One section: `listening-1` … `4`, `reading-1` … `3`, `writing`, `speaking` | Admin, seed script |
| `users/{uid}`                         | Profile: target band, exam date, preferences                               | App                |
| `users/{uid}/attempts/{attemptId}`    | One sitting of one module in one mode: answers, flags, notes, timer, score | App                |
| `users/{uid}/vocab/{wordId}`          | Saved words with meaning, Bangla, example, source and review schedule      | App, admin         |
| `media/manifest`                      | List of audio and image files deployed on Hosting (from `hash-media.ts`)   | Seed script        |

**Content schema (TypeScript shape of the Zod schema)**

```ts
type Track = 'academic' | 'general';
type Module = 'listening' | 'reading' | 'writing' | 'speaking';

interface TestMeta {
  testId: string; // "book21-test1"
  book: string; // "Book 21"
  testNumber: number;
  track: Track;
  status: 'draft' | 'live';
  timing: {
    listening: { singlePartMin: number; fullMockMin: number; checkMin: number }; // 8, 30, 2
    reading: { singlePartMin: number; fullMockMin: number }; // 20, 60
    writing: { task1Min: number; task2Min: number; fullMockMin: number }; // 20, 40, 60
  };
  studentHelp: {
    allowReveal: boolean;
    showScriptInSinglePart: boolean;
    lockAudioInFullMock: boolean;
  };
}

type QuestionType =
  | 'MULTIPLE_CHOICE_SINGLE'
  | 'MULTIPLE_CHOICE_MULTIPLE'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING_HEADINGS'
  | 'MATCHING_PARAGRAPH_INFO'
  | 'MATCHING_FEATURES'
  | 'MATCHING_SENTENCE_ENDINGS'
  | 'GAP_FILL' /* sentence, summary, note, table, flow-chart, form */
  | 'DIAGRAM_LABEL'
  | 'SHORT_ANSWER';

interface QuestionGroup {
  groupId: string; // "qg-1"
  type: QuestionType;
  instructions: string; // shown above the group
  wordLimit?: string; // "ONE WORD ONLY", "NO MORE THAN TWO WORDS AND/OR A NUMBER"
  maxWords?: number; // 1, 2, 3 (enforced in scoring)
  allowNumber?: boolean;
  layout?: GapLayout; // template for summary, note, table or form gaps
  options?: { key: string; text: string }[]; // A–G, i–x, list of headings or features
  answersPerItem?: number; // 2 for "Choose TWO letters" (numbers 21–22 share one item)
  questions: Question[];
}

interface Question {
  numbers: number[]; // [7] or [21, 22]
  prompt?: string; // statement, question or gap sentence ("___" marks the gap)
  acceptedAnswers: string[][]; // one list per number; alternatives allowed: [["envelope", "building envelope"]]
  explanation?: string;
  location?: AnswerLocation | null; // null = Not Given (nothing to highlight)
}

interface AnswerLocation {
  // Reading
  paragraph: string; // "B"
  sentence: number; // 1-based within the paragraph
  highlight: string; // exact words to highlight; must occur in that sentence
}

interface ReadingSection {
  kind: 'reading';
  part: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  paragraphs: { label: string; text: string }[]; // label "A"; text without the label
  groups: QuestionGroup[];
}

interface ScriptLine {
  start: number; // seconds from the start of the audio
  speaker: string;
  text: string;
  answer?: { question: number; highlight: string }; // highlight must occur in text
}

interface ListeningSection {
  kind: 'listening';
  part: 1 | 2 | 3 | 4;
  audio: string; // "/media/audio/b21t1-p1.8f3c.mp3"
  durationSec: number;
  context?: string; // "You will hear a caller asking about…"
  script: ScriptLine[];
  groups: QuestionGroup[];
}

interface WritingSection {
  kind: 'writing';
  task1: { prompt: string; image: string; imageDescription: string; minWords: number };
  task2: { prompt: string; minWords: number; modelAnswer?: string };
}

interface SpeakingSection {
  kind: 'speaking';
  part1: string[];
  part2: { topic: string; points: string[]; closing: string; prepSec: 60; speakSec: 120 };
  part3: string[];
}
```

**Attempt document**

```ts
interface Attempt {
  attemptId: string;
  testId: string;
  module: Module;
  mode: 'single' | 'full';
  part?: number; // set in single-part mode
  status: 'in_progress' | 'submitted';
  startedAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
  timeLeftSec: number;
  answers: Record<string, string>; // key = question number as a string
  flagged: number[];
  notes?: string;
  scriptMarks?: number[]; // highlighted audioscript line indexes
  revealUsed: boolean; // true once any answer was shown; excluded from band history
  score?: {
    raw: number;
    total: number;
    band: number;
    byType: Record<QuestionType, { correct: number; total: number }>;
  };
  writing?: { task1: string; task2: string; ai?: WritingFeedback };
  speaking?: {
    selfScores: Record<'fluency' | 'lexical' | 'grammar' | 'pronunciation', number>;
    covered: string[];
    recordingKeys: string[];
  };
}
```

**Implementation notes (Phase 1).** Firestore can't store an array inside an array, so
`acceptedAnswers` is stored as `[{ answers: string[] }]` and converted back by
`src/schema/firestore.ts`; content files keep `string[][]`. A `Question` may also carry its own
`options` for multiple choice where each question has different choices (Listening Q7–8 on the
canvas); group-level `options` remain for shared lists. The media manifest is
`content/media-manifest.json` (not under `public/`, so the file list isn't published).

**Implementation notes (Phase 5).** Writing feedback is per task:
`writing: { task1, task2, ai?: { task1?: WritingFeedback; task2?: WritingFeedback } }`. Writing's
Practice and Exam modes are the engine's `single` (one task, 20 or 40 min) and `full` (both
tasks, 60 min) modes, and its URL uses `part=` like the other modules rather than `task=`.
"Evaluate my essay" and "Submit writing" submit and stay on the page, which then shows the
read-only essays with their feedback.

**Implementation notes (Phase 6).** Speaking is one sitting across its three parts (stored as
`mode: 'full'`, no timer); the URL takes `?part=`. Each take is a record in the IndexedDB database
`ielts-practice`, store `recordings`, keyed `{attemptId}:p{part}:t{n}`, holding the audio Blob,
its length and its transcript; the attempt lists the keys in `speaking.recordingKeys`. Part 2
prepares for 60 s, then records up to 120 s and stops itself; Parts 1 and 3 record straight away,
up to 5 minutes. Pace and filler words come from the transcript, so they show "—" where there is
none. `speaking.covered` holds the ticked Part 2 points (`point-1` … the closing line last), and
`speaking.selfScores` may be partial until all four whole bands are chosen. "Finish speaking"
submits and stays on the page.

**Implementation notes (Phase 7).** `users/{uid}` holds `{ targetBand, examDate? }` (target 7.0
until set; edited from the Dashboard's "Edit goals"). A module's band comes from its latest
submitted attempt with no answers revealed: Listening and Reading from the score, Writing from
the AI feedback ((Task 1 + 2 × Task 2) ÷ 3, or Task 2 alone as an estimate), Speaking from all
four self-scores; attempts without a band don't count. Results re-mark Reading and Listening from
the saved answers, and when a question has no `explanation` the review shows where the answer is
(the paragraph and its words, or the audioscript time and words). History lists finished
attempts; the one in progress is on the Dashboard and in the Library's Continue banner. Starting a
module from the Dashboard opens the first test that module hasn't been finished on.

**Vocabulary document:** `word`, `pos`, `ipa`, `topic`, `meaning`, `bangla`, `example`, `source`
(`{ testId, question? }` or `"manual"`), `status` (`new`, `learning`, `mastered`), `srs`
(`{ due, intervalDays, ease, reps }`).

## 5. Auth and security rules

Only one Google account can read or write anything. Every page except the sign-in screen sits
behind an auth guard, and the Firestore rules enforce the same check on the server.

1. Enable Google as the only sign-in provider. Turn on user enumeration protection.
2. Sign in once, copy your UID from the Firebase console, and put it in the rules and in
   `VITE_OWNER_UID`.
3. If any other account signs in, the app signs it out and shows "This app is private".

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == "OWNER_UID";
    }
    match /{document=**} {
      allow read, write: if isOwner();
    }
  }
}
```

**Hosting headers** (in `firebase.json`): `X-Robots-Tag: noindex, nofollow` on every path,
`Cache-Control: public, max-age=31536000, immutable` on `/media/**` and hashed assets, and
`no-cache` on `index.html`. Add a `robots.txt` that disallows everything.

**Secrets.** The Firebase web config is not secret but goes in `.env` as `VITE_FIREBASE_*`. The
service-account key for `seed.ts` stays on your laptop and is listed in `.gitignore`. The deploy
workflow uses the `FIREBASE_SERVICE_ACCOUNT` secret that `firebase init hosting:github` creates.

**AI quota protection.** Turn on Firebase App Check (reCAPTCHA) for AI Logic, so the free Gemini
quota can only be used from your deployed app.

## 6. Screens and routes

The app has 11 student routes and one admin route. Each row names the canvas artboard to copy.

| Route                                              | Artboard                                                         | What it must do                                                                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                | Dashboard                                                        | Resume card for the in-progress attempt, latest band per module against the target, four module tiles, recent attempts table                                                 |
| `/library`                                         | Test library                                                     | Academic / General Training switch, module filter, search, a card per test with each module's band or status, Continue banner                                                |
| `/test/:testId/listening?mode=single\|full&part=n` | Listening test, Listening test (answers in script)               | Player, audioscript with follow-along and highlighter, question types, reveal, grid with paired numbers (21–22), part tabs                                                   |
| `/test/:testId/reading?mode=&part=`                | Reading test, Reading test (answers shown), Reading test (phone) | Split passage and questions, reveal with passage highlights, notes, flags, text size, grid, passage tabs; phone layout uses Passage / Questions tabs and a bottom sheet grid |
| `/test/:testId/writing?mode=&task=`                | Writing test (AI feedback)                                       | Task tabs, chart viewer with zoom and pan, live word count, Practice / Exam mode, AI feedback panel                                                                          |
| `/test/:testId/speaking?part=`                     | Speaking test                                                    | Part tabs, cue card and notes, Prepare → Speak → Review recorder, transcript with filler words, coverage checklist                                                           |
| `/results/:attemptId`                              | Results                                                          | Band, breakdown, distance to next band, accuracy by question type, answer review with explanations, filters                                                                  |
| `/history`                                         | (Results list)                                                   | All attempts, newest first, filter by module; attempts with `revealUsed` are marked "practice" and excluded from bands                                                       |
| `/bands`                                           | Band breakdown                                                   | Overall band with the rounding shown, module cards, what-if calculator, fastest route to target, per-module detail                                                           |
| `/vocabulary`                                      | Vocabulary                                                       | Topic and status filters, search, expandable word rows with Bangla, daily review flashcards, mastery by topic                                                                |
| `/admin/tests/:testId/:tab`                        | Admin (two artboards)                                            | Section 8                                                                                                                                                                    |
| `/signin`                                          | none                                                             | Google sign-in button and the private-app message                                                                                                                            |

**Shared exam components** (Listening, Reading, Writing; Speaking uses the header only)

- `ExamHeader`: back to library, test and part name, Single part / Full mock switch, notes, show
  answers, countdown, pause or resume, clear, focus mode, theme.
- `QuestionGrid`: answered count, one button per number (paired numbers share one), states for
  answered, unanswered, flagged and current; click jumps to the question and switches part.
- `SectionNav`: previous module link, part or task tabs, next module link, and the right-hand
  action (Evaluate in single part, Next part or Next module in full mock).
- `PausedOverlay`, `NotesPopover`, `RevealBanner` ("Answers are showing… won't count toward your
  band history").

## 7. Exam engine rules

All exam behaviour lives in `src/engine/` and `examStore.ts` as pure, unit-tested functions;
components only render state and call actions.

**Modes**

| Behaviour                | Single part                                                                | Full mock                                                                           |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Scope                    | One passage, part or task                                                  | Whole module in order: Listening parts 1–4, Reading passages 1–3, Writing tasks 1–2 |
| Timer (from test timing) | Listening 8 min per part, Reading 20 min per passage, Writing 20 or 40 min | Listening 30 + 2 min check, Reading 60 min, Writing 60 min                          |
| Grid                     | That part's numbers only                                                   | All 40 numbers, grouped by part                                                     |
| Audio                    | Play, pause, ±5 s, seek, speed 0.75–1.5×                                   | Plays once from the start, no pause, seek or speed                                  |
| Audioscript              | Shown on demand, follows the audio, highlighter                            | Hidden until submit                                                                 |
| Show answers             | Allowed if `studentHelp.allowReveal`                                       | Hidden until submit                                                                 |
| Bottom-right action      | Evaluate my <module> → Results                                             | Next part / passage, then Next: <module>                                            |
| Counts toward bands      | Yes, unless any answer was revealed                                        | Yes                                                                                 |

Switching mode resets the timer and part to the start and asks for confirmation if any answer is
filled.

**Timer, pause and autosave**

- Countdown in `mm:ss`; the timer pill turns red at 5:00 or less. At 0:00 the attempt
  auto-submits.
- Pause stops the timer and the audio and covers the passage with the Paused overlay. Full mock
  Listening does not offer pause.
- Every change saves to `localStorage` at once and to Firestore at most every 10 seconds, on part
  change and on submit. The header shows "Autosaved at hh:mm:ss". Reopening an in-progress
  attempt restores answers, flags, notes, part, audio position and time left.
- Clear removes answers, flags and script marks for the current part after a confirm.

**Show answers**

- The header lightbulb toggles all answers; each question or gap group also has its own
  lightbulb.
- When shown: the passage highlights `location.highlight` inside the given sentence (amber fill,
  dark amber outline, numbered badge after it); Listening marks `answer.highlight` in the
  audioscript the same way; each question shows Correct, "You wrote …" or Not answered, plus the
  answer and its paragraph or script time. Not Given shows "No matching text in the passage".
- Revealing any answer sets `revealUsed = true` and shows the banner. Highlighting matches the
  text exactly; if the highlight words are missing, highlight the whole sentence and log a
  warning.

**Listening audio and audioscript**

- The current line is the last line whose `start` is at or before the audio time; it gets the
  "Now playing" style and scrolls into view.
- Clicking a line seeks to its `start` and plays. With Highlighter on, clicking toggles a yellow
  mark instead; marks save to `scriptMarks`.
- Audio files are 64 kbps mono MP3, cached by the service worker after first play.

**Answer matching** (`engine/answers.ts`)

1. Normalise both sides: trim, lower-case, collapse spaces, curly to straight quotes, drop
   trailing full stops.
2. Accept any listed alternative. Words in brackets are optional: `(the) envelope` accepts
   "envelope" and "the envelope".
3. Numbers: accept digits or the word form when the answer is numeric ("14", "fourteen", "14th"
   for dates).
4. Word limit: if the group's `maxWords` is exceeded the answer is wrong, even if it contains the
   right word. Show an inline warning while typing.
5. Spelling must be exact; British and American variants count only if both are listed.
6. Paired items ("Choose TWO", numbers 21–22): each correct letter scores one mark, in any order;
   a letter used twice scores once.
7. TRUE / FALSE / NOT GIVEN and YES / NO / NOT GIVEN are not interchangeable.

**Bands**

These are the commonly published raw-score tables. They are approximate, so keep them in
`engine/bands.ts` as data that can be edited.

| Band | Listening | Academic Reading | General Training Reading |
| ---- | --------- | ---------------- | ------------------------ |
| 9.0  | 39–40     | 39–40            | 40                       |
| 8.5  | 37–38     | 37–38            | 39                       |
| 8.0  | 35–36     | 35–36            | 37–38                    |
| 7.5  | 32–34     | 33–34            | 36                       |
| 7.0  | 30–31     | 30–32            | 34–35                    |
| 6.5  | 26–29     | 27–29            | 32–33                    |
| 6.0  | 23–25     | 23–26            | 30–31                    |
| 5.5  | 18–22     | 19–22            | 27–29                    |
| 5.0  | 16–17     | 15–18            | 23–26                    |
| 4.5  | 13–15     | 13–14            | 19–22                    |
| 4.0  | 10–12     | 10–12            | 15–18                    |
| 3.5  | 8–9       | 8–9              | 12–14                    |
| 3.0  | 6–7       | 6–7              | 9–11                     |
| 2.5  | 4–5       | 4–5              | 6–8                      |

- **Single part estimate:** scale to 40 (`round(raw × 40 / questions)`), look up the band and
  label it "estimate".
- **Writing:** each task gets four criterion bands; the task band is their mean rounded down to
  the nearest half. Module band = (Task 1 + 2 × Task 2) ÷ 3, rounded to the nearest half. Task 2
  alone gives a "Task 2 only" estimate.
- **Speaking:** mean of the four self-assessed criteria, rounded down to the nearest half.
- **Overall:** mean of the four module bands. A fraction below .25 rounds down to the whole band,
  .25 to below .75 becomes .5, and .75 or more rounds up (6.625 → 6.5, 6.75 → 7.0). Bands and the
  what-if calculator use the same function.

**Writing AI feedback** (`lib/ai.ts`)

Send the task prompt, the image description (Task 1), the essay and its word count. Ask for JSON
only, validate it with Zod, and retry once on a parse error. Show it only in Practice mode or
after submit.

```ts
interface WritingFeedback {
  task: 1 | 2;
  criteria: {
    name:
      | 'Task achievement'
      | 'Task response'
      | 'Coherence and cohesion'
      | 'Lexical resource'
      | 'Grammatical range and accuracy';
    band: number;
    comment: string;
  }[];
  overall: number; // computed in the app from criteria, not trusted from the model
  topFixes: string[]; // exactly 3
  corrections: { original: string; suggested: string; reason: string }[]; // at most 5, original must occur in the essay
}
```

**Speaking**

Part 2 runs Prepare (60 s) → Speak (up to 120 s, auto-stop) → Review. Record with
`MediaRecorder` and keep the audio in IndexedDB only. Build the transcript with the browser's
speech recognition where available (Chrome). Filler words come from a list ("um", "uh", "like",
"you know", "I mean"); pace = words ÷ minutes.

**Gap layouts.** `GapLayout` is a small template:
`{ kind: 'summary' | 'notes' | 'table' | 'form' | 'flow'; title?: string; body: string }`, where
`body` is Markdown and `{{7}}` marks where the input for question 7 goes. Tables use Markdown
table syntax with `{{n}}` inside cells.

## 8. Admin panel

The admin panel is where you type in each test, link every answer to its proof, and publish. It
edits a draft in Firestore and writes the same JSON shape as `content/tests/`, so the app and the
seed script share one schema.

**Layout** (artboards "Admin: Reading answers and locations" and "Admin: Listening audio and
audioscript")

- Sidebar: Tests, Vocabulary, Media files, Import / export; a tree of books and tests with Draft,
  Live or Empty status; New book or test.
- Top bar: breadcrumb, test name, status, Preview as student (opens the matching student page with
  the draft), Publish test.
- Tabs: Settings, Listening, Reading, Writing, Speaking. Right column: Before publishing
  checklist, live JSON of the current tab, Import / export.

**Tabs**

| Tab       | What you enter                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings  | Book, test number, track, test ID; timer minutes for Single part and Full mock per module; switches for Show answers, audioscript in Single part and Full mock audio lock                          |
| Reading   | Per passage: title, text with `[A]`, `[B]` labels (Edit text view); question groups with type, instructions, word limit, options; per question: statement, accepted answers, explanation, location |
| Listening | Per part: audio file from the media manifest, duration, context line; audioscript lines with start time, speaker, text, answered question and highlight words; question groups as in Reading       |
| Writing   | Task 1 prompt, chart image, image description, minimum words; Task 2 prompt, minimum words, optional model answer                                                                                  |
| Speaking  | Part 1 questions, Part 2 cue card (topic, three points, closing line), Part 3 questions                                                                                                            |

**Linking a Reading answer to the passage** (Link answers view)

1. Pick a question in "Linking answer for", or press Link to passage on its row.
2. The passage shows one row per sentence, split on `.`, `!` or `?`. Click the sentence that
   proves the answer; click it again to unlink.
3. Type the exact words to highlight. They must appear in that sentence.
4. For a Not Given answer, press "No location (Not Given)" instead.

Each sentence shows the numbers of the questions linked to it. A question with no location shows
an amber "Needs a location" chip.

**Marking a Listening answer in the audioscript**

1. Paste the full script, or add lines one by one.
2. Set start times by typing `m:ss`, or press Tap along to set times: the audio plays and each tap
   stamps the next line.
3. On the line that contains an answer, choose the question number, then type the words to
   highlight.

Start times must increase. A time out of order gets an orange border.

**Adding audio and images (no browser uploads on the free plan)**

1. Put the file in `public/media/audio/` or `public/media/img/` and run `npm run media`. This
   converts audio to 64 kbps mono, adds a content hash to the name and updates
   `media-manifest.json`.
2. Commit and push. After the deploy, the file appears in the admin pickers.
3. Images under 700 KB may instead be stored inline in the section document as a data URL if you
   want to skip the deploy.

**Before publishing** (all must pass; Publish stays disabled until they do)

- [ ] Every question has at least one accepted answer
- [ ] Every Reading answer has a location or is marked Not Given, and every location has
      highlight words found in its sentence
- [ ] Every Listening question number is marked on exactly one script line, and the highlight
      words occur in that line
- [ ] Script start times increase and are below the audio duration
- [ ] Question numbers run 1–40 with no gaps or duplicates (paired items count twice)
- [ ] Every media path exists in the manifest
- [ ] Task 1 image has a description
- [ ] The section passes the Zod schema

**Publish** sets `status: 'live'` and writes `tests/{testId}` and its sections in one batched
write. **Import** accepts a test JSON file, validates it, shows a diff and only then replaces the
draft. **Export** downloads the test as JSON so you can commit it to `content/tests/`.

## 9. Design system

Navy and slate carry the interface; IELTS red is reserved for the brand mark, Submit, the timer
warning and the band target marker. Put these values in `styles/tokens.css` and the Tailwind
theme, and never hard-code other colours.

| Token           | Value                         | Use                                                       |
| --------------- | ----------------------------- | --------------------------------------------------------- |
| `--red`         | #E11B22                       | Brand mark, Submit, timer at 5:00 or less, target marker  |
| `--navy`        | #0F172A                       | Headers, primary buttons, headings, current-question ring |
| `--navy-2`      | #1E293B                       | Controls on navy, segmented tracks                        |
| `--canvas`      | #F8FAFC                       | Page background                                           |
| `--text`        | #1E293B                       | Body text                                                 |
| `--muted`       | #475569                       | Secondary text (meets 4.5:1 on white)                     |
| `--border`      | #E2E8F0                       | Card and panel borders                                    |
| `--answered`    | #1D4ED8                       | Answered grid cell, selected option                       |
| `--unanswered`  | #94A3B8                       | Outline of unanswered cells                               |
| `--flag`        | #F59E0B fill, #92400E stroke  | Flag star                                                 |
| `--answer-hl`   | #FEF3C7 fill, #B45309 outline | Revealed answer in passage or script                      |
| `--user-hl`     | #FEF08A                       | Student highlighter                                       |
| `--now-playing` | #EFF6FF fill, #3B82F6 border  | Current audioscript line                                  |
| `--good`        | #DCFCE7 / #166534             | Correct, on target                                        |
| `--warn`        | #FFEDD5 / #9A3412             | Wrong, below target, focus area                           |

**Type.** IBM Plex Sans for the interface, Source Serif 4 for passages, essays and cue cards
(18 px, line height 1.8 in Reading), IBM Plex Mono for timers, scores and question numbers, Hind
Siliguri for Bangla. Weights 400, 500, 600, 700.

**Shape and spacing.** 8 px radius on controls, 12–16 px on cards, 999 px on pills; 4 px spacing
scale; card padding 20–28 px.

**Accessibility rules**

- Every tap target is at least 44 × 44 px; grid cells are 40–44 px.
- Real `<button>`, `<a>`, `<input>` and `<label>` only; icon buttons get `aria-label`; toggles use
  `aria-pressed`.
- States never rely on colour alone: answered cells are filled, flags add a star, results add a
  word (Correct, Incorrect, Skipped).
- Text contrast at least 4.5:1; the timer warning keeps white text on red (4.7:1).
- Every layout works at 390 px wide: split panes stack, Reading switches to Passage / Questions
  tabs and the grid moves into a bottom sheet.
- Dark mode: add a second token set under `[data-theme="dark"]`; components read tokens only.

## 10. Build plan for Claude Code

Build in 11 phases, one Claude Code session each, in this order; each phase ends with green tests,
a deploy and your review before the next starts. Phase 1's sample test (Book 21 Test 1, from the
canvas) feeds every later phase.

| Phase                   | Build                                                                                                                                                                                           | Done when                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 0. Setup                | Vite + React + TS strict, Tailwind with section 9 tokens, ESLint, Vitest, Playwright; Firebase project, Google sign-in, owner guard, `firestore.rules`; `firebase init hosting:github` workflow | Pushing to `main` deploys a signed-in "Hello" page; any other Google account is refused; `npm test` passes        |
| 1. Content              | Zod schemas (section 4), `validate-content.ts`, `hash-media.ts`, `seed.ts`; `content/tests/book21-test1.json` with the canvas sample (Reading passage 1, Listening part 1, Writing, Speaking)   | `npm run validate` passes; seed writes the test to Firestore; a broken file fails with a clear message            |
| 2. Exam shell           | `examStore`, timer, pause, autosave and resume, `ExamHeader`, `QuestionGrid`, `SectionNav`, `PausedOverlay`, `NotesPopover`, mode switch                                                        | Unit tests cover timer, autosave and mode reset; reload restores an attempt exactly                               |
| 3. Reading              | Passage panel with paragraph labels, every question type, word-limit warnings, flags, text size, show answers with passage highlights, submit and scoring, phone layout                         | Matches the Reading artboards; answer matching and band unit tests pass; e2e: answer, reveal, submit, see Results |
| 4. Listening            | Audio player, Full mock lock, audioscript follow-along, click to seek, highlighter, show answers in script, form and table gaps, paired numbers 21–22                                           | Matches the Listening artboards; current line follows the audio within 0.5 s; Full mock cannot seek               |
| 5. Writing              | Editor with live word count, Task 1 chart viewer (zoom 100–300 %, pan), Practice and Exam modes, AI feedback via AI Logic with Zod-checked JSON                                                 | Feedback renders for the sample essay; bad model output shows a retry message, never a crash                      |
| 6. Speaking             | Part tabs, cue card, notes, recorder with Prepare → Speak → Review, IndexedDB recordings, transcript, filler count, checklist, self-scores                                                      | Recording survives reload; transcript appears in Chrome; other browsers show "transcript not available"           |
| 7. Results and progress | Results page, History, Band breakdown with what-if, Dashboard, Library                                                                                                                          | Overall rounding unit tests pass (6.625 → 6.5, 6.75 → 7.0); revealed attempts are excluded                        |
| 8. Vocabulary           | Word list, filters, search, Bangla, save-from-passage (double-tap a word), daily review with SM-2 style scheduling                                                                              | Review queue shows due words only; Got it / Again reschedule correctly                                            |
| 9. Admin                | Tabs, Reading answer locator, audioscript editor, Writing and Speaking forms, checklist, live JSON, publish, import with diff, export                                                           | You can enter a full test from scratch and publish it; the student pages show it with working highlights          |
| 10. Polish              | PWA offline audio, dark mode, empty and error states, loading skeletons, Lighthouse accessibility 95+                                                                                           | Works offline for a cached test; all e2e tests pass on desktop and 390 px                                         |

**How to run a phase in Claude Code**

1. Start in the repo root so it reads `CLAUDE.md`.
2. Paste the phase prompt below, with N and the phase name filled in.
3. Review the plan it writes, let it build, then check the result against "Done when" and the
   canvas.

```text
Read CLAUDE.md and docs/SPEC.md. We are doing Phase N: <name>.
1. Write a short plan: files to create or change, tests to add. Wait for my OK.
2. Build it in small commits. Keep engine logic pure and unit-tested.
3. Match the canvas artboard(s) for this phase: layout, states, copy.
4. Run lint, unit and e2e tests. Fix failures before you stop.
5. Finish with: what you built, what is left, anything in the spec you had to assume.
```

## 11. Deployment and CI

Every push to `main` deploys to Firebase Hosting through GitHub Actions; every pull request gets a
temporary preview URL. Firestore rules deploy from the same workflow.

**One-time setup** (step-by-step version: `docs/SETUP.md`)

1. Create a Firebase project on the Spark plan; add a web app; enable Google sign-in and
   Firestore.
2. Install the Firebase CLI and run `firebase login`, then `firebase init` choosing Hosting and
   Firestore.
3. Run `firebase init hosting:github`. It creates the deploy and preview workflows and the
   `FIREBASE_SERVICE_ACCOUNT` secret.
4. Add the `VITE_FIREBASE_*` and `VITE_OWNER_UID` values as repository secrets and to
   `.env.local`.
5. In Hosting settings, keep only the last 5 releases so old media does not fill the 10 GB.

**`firebase.json`**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
      {
        "source": "/media/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
    ]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
}
```

**Workflows**

| File          | Runs on                     | Steps                                                                                                 |
| ------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ci.yml`      | Every push and pull request | Install, lint, typecheck, `npm run validate`, unit tests, build, Playwright against the preview build |
| `deploy.yml`  | Push to `main`              | CI steps, then deploy Hosting and Firestore rules                                                     |
| `preview.yml` | Pull request                | Build and deploy to a preview channel; comment the URL on the PR                                      |

**Scripts in `package.json`:** `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`,
`validate` (content), `media` (hash and convert files; needs ffmpeg), `seed` (push content to
Firestore; local only).

## 12. CLAUDE.md for the repo

Save this as `CLAUDE.md` in the repo root and export this document to `docs/SPEC.md`; Claude Code
reads the first automatically and follows it to the second.

```markdown
# IELTS Practice Platform

Personal IELTS computer-delivered mock test app. One user. Full spec: docs/SPEC.md.
Design canvas (source of truth for UI): https://claude.ai/artifact/ADeMvfJhekj5tK7s91Ph2D

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
```

## 13. Risks and open decisions

The biggest risk is the Writing AI: confirm Firebase AI Logic's free Gemini quota on the Spark
plan before Phase 5, because everything else runs inside proven free limits.

| Risk                                          | Effect                                                      | Mitigation                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AI Logic free quota changes or needs Blaze    | No Writing feedback                                         | Check current Firebase pricing in Phase 0; fallback: paste-your-own-key mode for the Gemini API stored only in the browser |
| Test content is copyrighted (Cambridge books) | Takedown or legal exposure if shared                        | Private repo, owner-only rules, hashed media names, `noindex`; never share preview links                                   |
| Hosting transfer cap 360 MB/day               | Audio stops loading late in a heavy day                     | 64 kbps mono audio (about 15 MB per full test), service-worker cache after first play                                      |
| Hosting files are public by URL               | Anyone with an exact link could fetch audio                 | Content-hashed names, no directory listing, `noindex`                                                                      |
| Band tables are approximate                   | Estimates differ from official results by up to half a band | Keep tables editable in `engine/bands.ts`; label every band as an estimate                                                 |
| Speech recognition is Chrome-only             | No Speaking transcript on other browsers                    | Show "transcript not available"; recording still works                                                                     |
| Firestore 1 MiB document limit                | A large section fails to save                               | One document per section; images inline only under 700 KB                                                                  |
| Single hard-coded owner UID                   | Locked out if the account changes                           | UID in rules and env; update both and redeploy                                                                             |

**Open decisions**

- [ ] Confirm AI Logic quota and model name on the free plan (Phase 0) — findings recorded in
      `docs/SETUP.md`
- [ ] General Training Writing Task 1 (letter) prompt format, if you will practise GT
- [ ] Whether Speaking self-scores should also get an AI estimate from the transcript later
- [ ] Dark-mode token values (Phase 10)
