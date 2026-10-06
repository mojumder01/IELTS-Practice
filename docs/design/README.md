# Design canvas sources

These files are a copy of the artboards on the design canvas
[IELTS Practice Platform UI](https://claude.ai/artifact/ADeMvfJhekj5tK7s91Ph2D), the source of
truth for every screen (SPEC section 1). The canvas is authoritative; refresh these copies when it
changes.

Each `.dc.html` file is one artboard: HTML with inline styles, `{{holes}}` filled by the
`Component` class at the bottom (its `renderVals()` holds the sample data and interactions), and
`<sc-for>` / `<sc-if>` for repeats and branches. Read them for layout, states, copy and spacing.
Colours in them are literal hex values; in the app they map to the tokens in
`src/styles/tokens.css`. `canvas.json` lists the artboards and their sizes.

| File                     | Artboard                               | Route (SPEC section 6)          |
| ------------------------ | -------------------------------------- | ------------------------------- |
| `Main.dc.html`           | Dashboard                              | `/`                             |
| `Library.dc.html`        | Test library                           | `/library`                      |
| `Listening.dc.html`      | Listening test                         | `/test/:testId/listening`       |
| `ListeningAnswers.dc.html` | Listening test (answers in script)   | `/test/:testId/listening`       |
| `Reading.dc.html`        | Reading test                           | `/test/:testId/reading`         |
| `ReadingAnswers.dc.html` | Reading test (answers shown)           | `/test/:testId/reading`         |
| `ReadingPhone.dc.html`   | Reading test (phone, 390 × 844)        | `/test/:testId/reading`         |
| `Writing.dc.html`        | Writing test (AI feedback)             | `/test/:testId/writing`         |
| `Speaking.dc.html`       | Speaking test                          | `/test/:testId/speaking`        |
| `Results.dc.html`        | Results                                | `/results/:attemptId`, `/history` |
| `Bands.dc.html`          | Band breakdown                         | `/bands`                        |
| `Vocabulary.dc.html`     | Vocabulary                             | `/vocabulary`                   |
| `Admin.dc.html`          | Admin: Reading answers and locations   | `/admin/tests/:testId/:tab`     |
| `AdminListening.dc.html` | Admin: Listening audio and audioscript | `/admin/tests/:testId/:tab`     |

There is no artboard for `/signin`; it reuses the Dashboard's card, brand mark and button styles.
