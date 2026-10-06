import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import type { WritingSection } from '../../schema/test';
import { ChartViewer } from './ChartViewer';

interface TaskPromptProps {
  section: WritingSection;
  task: 1 | 2;
  minutes: number;
  notes: string;
  onNotes: (notes: string) => void;
  readOnly: boolean;
}

/** The task as on the question paper, the Task 1 chart, and planning notes (Writing artboard). */
export function TaskPrompt({ section, task, minutes, notes, onNotes, readOnly }: TaskPromptProps) {
  const [chartOpen, setChartOpen] = useState(false);
  const t = task === 1 ? section.task1 : section.task2;
  const paragraphs = t.prompt.split(/(?<=[.?])\s+(?=[A-Z])/);
  return (
    <article aria-label="Task prompt" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Writing Task {task}
        </p>
        <p className="m-0 text-sm text-muted">
          You should spend about {minutes} minutes on this task.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 font-serif text-[17px] leading-relaxed text-text">
        {paragraphs.map((p, i) => (
          <p key={i} className={`m-0 ${i === 0 ? 'font-semibold text-navy' : ''}`}>
            {p}
          </p>
        ))}
      </div>
      {task === 1 && (
        <button
          type="button"
          onClick={() => setChartOpen(true)}
          aria-label="Enlarge the chart"
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 text-left hover:border-border-strong"
        >
          <img
            src={section.task1.image}
            alt={section.task1.imageDescription}
            className="w-full rounded-control"
          />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Maximize2 aria-hidden="true" className="size-3.5" />
            Select to enlarge · zoom and pan
          </span>
        </button>
      )}
      <p className="m-0 text-sm font-medium text-navy">Write at least {t.minWords} words.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="planning-notes" className="text-sm font-semibold text-navy">
          Planning notes
        </label>
        <textarea
          id="planning-notes"
          value={notes}
          readOnly={readOnly}
          onChange={(e) => onNotes(e.target.value)}
          className="min-h-24 resize-y rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm leading-normal"
        />
        <span className="text-xs text-muted">Notes are not counted or marked.</span>
      </div>
      {chartOpen && (
        <ChartViewer
          src={section.task1.image}
          description={section.task1.imageDescription}
          onClose={() => setChartOpen(false)}
        />
      )}
    </article>
  );
}
