/** Whether the browser can read a word aloud (Web Speech synthesis, free and on-device). */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Reads a word in a British voice where there is one. */
export function speak(word: string): void {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-GB';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'en-GB');
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
