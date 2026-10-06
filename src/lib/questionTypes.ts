import type { QuestionType } from '../schema/test';

/** How question types are named on Results and Bands. */
export const TYPE_NAMES: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Multiple choice',
  MULTIPLE_CHOICE_MULTIPLE: 'Multiple choice (choose more than one)',
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  YES_NO_NOT_GIVEN: 'Yes / No / Not Given',
  MATCHING_HEADINGS: 'Matching headings',
  MATCHING_PARAGRAPH_INFO: 'Matching information',
  MATCHING_FEATURES: 'Matching features',
  MATCHING_SENTENCE_ENDINGS: 'Matching sentence endings',
  GAP_FILL: 'Completion',
  DIAGRAM_LABEL: 'Diagram labelling',
  SHORT_ANSWER: 'Short answer',
};
