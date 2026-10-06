import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

interface ChartViewerProps {
  src: string;
  description: string;
  onClose: () => void;
}

const ZOOMS = [100, 150, 200, 250, 300];
const PAN_STEP = 40;
const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [PAN_STEP, 0],
  ArrowRight: [-PAN_STEP, 0],
  ArrowUp: [0, PAN_STEP],
  ArrowDown: [0, -PAN_STEP],
};

type Point = { x: number; y: number };

/** Keeps the zoomed image covering the frame: it can't be dragged off screen. */
function clampPan(p: Point, frame: HTMLElement | null, zoom: number): Point {
  const maxX = frame ? (frame.clientWidth * (zoom / 100 - 1)) / 2 : 0;
  const maxY = frame ? (frame.clientHeight * (zoom / 100 - 1)) / 2 : 0;
  return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
}

/** The Task 1 chart, enlarged: zoom 100–300%, drag or use the arrow keys to pan. */
export function ChartViewer({ src, description, onClose }: ChartViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: Point } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape closes; the arrow keys pan a zoomed chart wherever focus is in the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const move = PAN_KEYS[e.key];
      if (!move || zoom === 100) return;
      e.preventDefault();
      setPan((p) => clampPan({ x: p.x + move[0], y: p.y + move[1] }, frameRef.current, zoom));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom]);

  const clamp = (p: Point, z = zoom) => clampPan(p, frameRef.current, z);
  const zoomTo = (z: number) => {
    setZoom(z);
    setPan((p) => clamp(p, z));
  };
  const i = ZOOMS.indexOf(zoom);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (zoom === 100) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: pan };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) setPan(clamp({ x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y }));
  };
  const tool =
    'flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-navy disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Enlarged chart"
        className="flex max-h-full w-full max-w-[960px] flex-col gap-3 rounded-card bg-surface p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-navy">Task 1 chart</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={i <= 0}
              onClick={() => zoomTo(ZOOMS[i - 1]!)}
              className={tool}
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Reset zoom (now ${zoom}%)`}
              onClick={() => {
                setZoom(100);
                setPan({ x: 0, y: 0 });
              }}
              className="min-h-11 min-w-16 rounded-control border border-border-strong bg-surface px-2 font-mono text-sm font-semibold text-navy"
            >
              {zoom}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={i >= ZOOMS.length - 1}
              onClick={() => zoomTo(ZOOMS[i + 1]!)}
              className={tool}
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close chart"
              onClick={onClose}
              className={tool}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        <div
          ref={frameRef}
          role="img"
          aria-label={`${description}${zoom > 100 ? ' Drag or use the arrow keys to pan.' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          className={`relative aspect-[16/9] w-full touch-none overflow-hidden rounded-control border border-border bg-surface ${
            zoom > 100 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain select-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})` }}
          />
        </div>
        <p className="m-0 text-[13px] text-muted">
          Zoom in, then drag or use the arrow keys to pan.
        </p>
      </section>
    </div>
  );
}
