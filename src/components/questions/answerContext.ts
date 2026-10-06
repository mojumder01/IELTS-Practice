import { createContext, useContext } from 'react';
import type { Question } from '../../schema/test';

/** How each module says where an answer comes from: "Paragraph B, highlighted", "at 0:14". */
export interface AnswerSource {
  where: (question: Question, number: number) => string;
}

export const AnswerSourceContext = createContext<AnswerSource>({ where: () => '' });

export function useAnswerSource(): AnswerSource {
  return useContext(AnswerSourceContext);
}
