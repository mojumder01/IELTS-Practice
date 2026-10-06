/** "Tuesday, 6 October", as in the Dashboard artboard. */
export function formatToday(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${weekday}, ${dayMonth}`;
}
