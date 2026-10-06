/** The optional build settings the app reads directly (the Firebase config goes through readEnv). */
interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_WRITING_MODEL?: string;
}
