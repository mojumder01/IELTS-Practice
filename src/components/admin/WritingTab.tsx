import { useState } from 'react';
import { blankWriting } from '../../admin/draft';
import type { MediaManifest } from '../../schema/media';
import type { TestFile, WritingSection } from '../../schema/test';
import { LocalInput } from './LocalText';
import { input, label, panel, smallButton } from './ui';

interface WritingTabProps {
  draft: TestFile;
  update: (edit: (d: TestFile) => void) => void;
  manifest: MediaManifest | null;
}

const MAX_INLINE_BYTES = 700 * 1024;

/** Task 1 prompt, chart and description; Task 2 prompt and an optional model answer. */
export function WritingTab({ draft, update, manifest }: WritingTabProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const section = draft.sections.writing?.kind === 'writing' ? draft.sections.writing : undefined;
  const edit = (fn: (s: WritingSection) => void) =>
    update((d) => {
      if (d.sections.writing?.kind === 'writing') fn(d.sections.writing);
    });
  if (!section) {
    return (
      <section className={panel}>
        <button
          type="button"
          onClick={() =>
            update((d) => {
              d.sections.writing = blankWriting();
            })
          }
          className={`${smallButton} self-start`}
        >
          Add Writing
        </button>
      </section>
    );
  }
  const images = manifest?.files.filter((f) => f.kind === 'image') ?? [];
  const inline = section.task1.image.startsWith('data:');

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="w1-h" className={panel}>
        <h2 id="w1-h" className="m-0 text-lg font-semibold text-navy">
          Task 1
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="w1-prompt" className={label}>
            Prompt
          </label>
          <textarea
            id="w1-prompt"
            value={section.task1.prompt}
            onChange={(e) => edit((s) => void (s.task1.prompt = e.target.value))}
            className={`${input} min-h-24 py-2`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1">
            <label htmlFor="w1-img" className={label}>
              Chart image (from the media manifest)
            </label>
            <select
              id="w1-img"
              value={inline ? 'inline' : section.task1.image}
              onChange={(e) =>
                edit(
                  (s) =>
                    void (s.task1.image =
                      e.target.value === 'inline' ? s.task1.image : e.target.value),
                )
              }
              className={input}
            >
              <option value="">Choose an image</option>
              {inline && <option value="inline">Uploaded image (stored in the test)</option>}
              {images.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.path.replace('/media/img/', '')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="w1-file" className={label}>
              Or a small image (under 700 KB)
            </label>
            <input
              id="w1-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_INLINE_BYTES) {
                  setImageError('That image is over 700 KB: add it with npm run media instead.');
                  return;
                }
                setImageError(null);
                const reader = new FileReader();
                reader.onload = () => {
                  const url = typeof reader.result === 'string' ? reader.result : '';
                  edit((s) => void (s.task1.image = url));
                };
                reader.readAsDataURL(file);
              }}
              className="min-h-11 text-sm"
            />
          </div>
        </div>
        {imageError && (
          <p role="alert" className="m-0 text-sm text-warn-text">
            {imageError}
          </p>
        )}
        {section.task1.image && section.task1.image !== '/media/img/' && (
          <img
            src={section.task1.image}
            alt=""
            className="max-h-64 self-start rounded-control border border-border"
          />
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="w1-alt" className={label}>
            Describe the image (for screen readers and AI marking)
          </label>
          <textarea
            id="w1-alt"
            value={section.task1.imageDescription}
            onChange={(e) => edit((s) => void (s.task1.imageDescription = e.target.value))}
            className={`${input} min-h-20 py-2`}
          />
        </div>
        <div className="flex w-40 flex-col gap-1">
          <label htmlFor="w1-min" className={label}>
            Minimum words
          </label>
          <LocalInput
            id="w1-min"
            inputMode="numeric"
            initial={String(section.task1.minWords)}
            onText={(text) =>
              edit((s) => void (s.task1.minWords = Number.parseInt(text, 10) || s.task1.minWords))
            }
            className={input}
          />
        </div>
      </section>

      <section aria-labelledby="w2-h" className={panel}>
        <h2 id="w2-h" className="m-0 text-lg font-semibold text-navy">
          Task 2
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="w2-prompt" className={label}>
            Prompt
          </label>
          <textarea
            id="w2-prompt"
            value={section.task2.prompt}
            onChange={(e) => edit((s) => void (s.task2.prompt = e.target.value))}
            className={`${input} min-h-24 py-2`}
          />
        </div>
        <div className="flex w-40 flex-col gap-1">
          <label htmlFor="w2-min" className={label}>
            Minimum words
          </label>
          <LocalInput
            id="w2-min"
            inputMode="numeric"
            initial={String(section.task2.minWords)}
            onText={(text) =>
              edit((s) => void (s.task2.minWords = Number.parseInt(text, 10) || s.task2.minWords))
            }
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="w2-model" className={label}>
            Model answer (optional)
          </label>
          <textarea
            id="w2-model"
            value={section.task2.modelAnswer ?? ''}
            placeholder="Paste a band 8 or 9 sample answer"
            onChange={(e) => edit((s) => void (s.task2.modelAnswer = e.target.value || undefined))}
            className={`${input} min-h-32 py-2`}
          />
        </div>
      </section>
    </div>
  );
}
