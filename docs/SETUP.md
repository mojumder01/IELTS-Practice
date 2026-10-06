# One-time setup

Phase 0 needs a Firebase project, your owner UID and a few GitHub secrets. Do these once, in
order. Everything stays on the free Spark plan; never add a billing account.

## 1. Create the Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project. Turn
   Google Analytics off (it isn't used).
2. **Project settings → General → Your apps → Add app → Web.** Give it a nickname, leave
   "Also set up Firebase Hosting" unticked, and register it. Keep the `firebaseConfig` values it
   shows; you need them in steps 3 and 5.
3. **Build → Authentication → Get started → Sign-in method:** enable **Google** only.
   Then **Settings → User actions:** turn on **Email enumeration protection**.
4. **Build → Firestore Database → Create database:** production mode, in the region closest to
   you (it can't be changed later). The rules this repo deploys replace the default ones.

## 2. Run the app locally

```sh
npm install
cp .env.example .env.local
```

Fill in `.env.local` from the `firebaseConfig` in step 1.2. Set `VITE_OWNER_UID=pending` for now:
you don't have a UID until you've signed in once.

```sh
npm run dev
```

Open <http://localhost:5173> and sign in with your Google account. The app shows
**"This app is private"** and signs you out; that is expected, and it creates your user.

## 3. Set your owner UID

1. In **Authentication → Users**, copy the **User UID** of your account.
2. Put it in `.env.local` as `VITE_OWNER_UID`, restart `npm run dev` and sign in again. You
   should see **Hello, <your name>**. Any other Google account is refused.

The UID is also the only account the Firestore rules allow. You don't edit `firestore.rules`:
the deploy workflow writes the UID into it from the `VITE_OWNER_UID` secret.

## 4. Point the Firebase CLI at the project

```sh
npx firebase-tools login
npx firebase-tools use --add      # pick the project, alias "default"
```

This rewrites `.firebaserc` with your project ID; commit that change.

## 5. Add the GitHub repository secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret                              | Value                     |
| ----------------------------------- | ------------------------- |
| `VITE_FIREBASE_API_KEY`             | `apiKey`                  |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `authDomain`              |
| `VITE_FIREBASE_PROJECT_ID`          | `projectId`               |
| `VITE_FIREBASE_APP_ID`              | `appId`                   |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId`       |
| `VITE_OWNER_UID`                    | your User UID from step 3 |

## 6. Create the deploy service account

```sh
npx firebase-tools init hosting:github
```

Answer with this repository (`mojumder01/IELTS-Practice`). When it asks whether to run a build
script before every deploy, and whether to deploy when a PR is merged, answer **No**: this repo's
workflows already do both.

The command creates a service account, stores its key as a repository secret named
`FIREBASE_SERVICE_ACCOUNT_<YOUR_PROJECT_ID>`, and adds `firebase-hosting-*.yml` workflow files.
Then:

1. Delete the `firebase-hosting-*.yml` files it added (`deploy.yml` and `preview.yml` replace
   them) and undo any change it made to `firebase.json` (`git checkout firebase.json`).
2. In `.github/workflows/deploy.yml` and `.github/workflows/preview.yml`, change
   `secrets.FIREBASE_SERVICE_ACCOUNT` to `secrets.FIREBASE_SERVICE_ACCOUNT_<YOUR_PROJECT_ID>`
   (the exact name is listed under the repository's Actions secrets). GitHub can't rename a
   secret, so the workflows follow the name the CLI chose.
3. The service account can deploy Hosting but not Firestore rules. In the
   [Google Cloud console](https://console.cloud.google.com/iam-admin/iam), select the project,
   find the principal that starts with `github-action-`, choose **Edit**, and add these roles:
   **Firebase Rules Admin**, **Cloud Datastore Index Admin** and **Service Usage Consumer**.
   If a deploy still stops with a 403, its log names the missing permission.

## 7. Deploy

Commit and push to `main`. The **Deploy** workflow runs lint, type checks, unit and e2e tests,
builds with the secrets, writes your UID into the Firestore rules, and deploys Hosting and the
rules. Open `https://<project-id>.web.app`: you should see the sign-in page, then **Hello** after
signing in. Any other Google account sees "This app is private".

Every pull request also gets a temporary preview URL (7 days), posted as a PR comment. Preview
links expose test content: never share them.

## 8. Hosting housekeeping

In **Hosting → (your site) → ⋮ → Release storage settings**, keep only the last **5** releases so
old media doesn't fill the 10 GB.

## Open decision: Writing AI on the free plan (SPEC section 13)

Checked on 6 Oct 2026, ahead of Phase 5:

- **Spark works.** Firebase AI Logic is free to use, and with the **Gemini Developer API**
  provider its free tier needs no billing account. The Vertex AI provider needs Blaze, so don't
  pick it.
- **Model:** choose a current stable **Flash** model when Phase 5 starts and keep its name in one
  constant in `src/lib/ai.ts`. The Gemini 2.5 models retire on 20 October 2026, so don't build on
  them.
- **Quota:** Flash models' free limits are in the order of 10 requests a minute and a few hundred
  or more a day, far above one person's essays. Google changes these often: confirm the current
  limits in Google AI Studio and in the Firebase console's AI Logic page before Phase 5, and keep
  the paste-your-own-key fallback from SPEC section 13 in mind.
- Turn on **App Check** (reCAPTCHA) for AI Logic in Phase 5, so only the deployed app can spend
  the quota.

## Running the tests

```sh
npm run lint && npm run typecheck && npm test
npm run test:e2e
```

`test:e2e` builds its own copy of the app (into `dist-e2e/`) against a placeholder Firebase
project, so it needs no secrets. Playwright needs Chromium: run `npx playwright install chromium`
once, or, where a Chromium is already installed, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at it.
