import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * An input that keeps what's typed and reports each change, for fields stored parsed (answers
 * split on "/", options one per line), where re-formatting on every key would eat the separator.
 * Remount it (change its key) to show a new value from outside.
 */
export function LocalInput({
  initial,
  onText,
  ...rest
}: { initial: string; onText: (text: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [text, setText] = useState(initial);
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onText(e.target.value);
      }}
    />
  );
}

export function LocalTextArea({
  initial,
  onText,
  ...rest
}: { initial: string; onText: (text: string) => void } & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
>) {
  const [text, setText] = useState(initial);
  return (
    <textarea
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onText(e.target.value);
      }}
    />
  );
}
