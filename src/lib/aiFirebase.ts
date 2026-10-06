import type { FirebaseApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { modelFeedbackJsonSchema, type Generate } from './ai';

/**
 * The model for Writing feedback, through Firebase AI Logic's Gemini Developer API (free on the
 * Spark plan). Override with VITE_WRITING_MODEL; see docs/SETUP.md on choosing a current model.
 */
export const WRITING_MODEL: string = import.meta.env.VITE_WRITING_MODEL || 'gemini-3.6-flash';

export function firebaseGenerate(app: FirebaseApp): Generate {
  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: WRITING_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: modelFeedbackJsonSchema,
      temperature: 0.2,
    },
  });
  return async (prompt) => (await model.generateContent(prompt)).response.text();
}
