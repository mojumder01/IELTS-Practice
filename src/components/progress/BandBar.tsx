interface BandBarProps {
  band: number | null;
  target: number;
}

/** A band out of 9 with the target as a red mark (the number is always shown next to it). */
export function BandBar({ band, target }: BandBarProps) {
  return (
    <div aria-hidden="true" className="relative h-2 rounded-pill bg-border">
      {band !== null && (
        <div
          className={`h-full rounded-pill ${band >= target ? 'bg-good-text' : 'bg-navy'}`}
          style={{ width: `${(band / 9) * 100}%` }}
        />
      )}
      <div
        className="absolute -top-1 h-4 w-0.5 rounded-pill bg-red"
        style={{ left: `calc(${(target / 9) * 100}% - 1px)` }}
      />
    </div>
  );
}
