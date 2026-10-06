/** Topics offered when adding a word; saved words can use any other. */
export const TOPICS = [
  'Environment',
  'Urban life',
  'Education',
  'Technology',
  'Health',
  'Work',
  'General',
];

export const STATUS_CHIP = {
  mastered: { label: 'Mastered', className: 'bg-good text-good-text' },
  learning: { label: 'Learning', className: 'bg-now-playing text-answered' },
  new: { label: 'New', className: 'bg-surface-muted text-navy-3' },
} as const;
