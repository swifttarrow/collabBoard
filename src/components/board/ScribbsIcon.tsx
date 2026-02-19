"use client";

type Props = {
  className?: string;
  size?: number;
  /** When true, shows open mouth (chat is open); when false, closed mouth. */
  mouthOpen?: boolean;
};

const BODY = "#475569";
const STROKE = "#334155";
const ACCENT = "#E8A598";
const EYES = "#7DD3FC";

/** Scribbs: a cute little robot mascot. mouthOpen=true when chat is open. */
export function ScribbsIcon({ className, size = 24, mouthOpen = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g transform={mouthOpen ? "rotate(-10, 12, 12)" : undefined}>
        {/* Antenna stem */}
        <line x1="12" y1="1" x2="12" y2="4" stroke={BODY} strokeWidth="0.8" strokeLinecap="round" />
        {/* Antenna ball */}
        <circle cx="12" cy="0.8" r="1" fill={ACCENT} stroke={STROKE} strokeWidth="0.4" />
        {/* Head - rounded rect, wider than tall */}
        <rect x="4" y="4.5" width="16" height="9" rx="2.5" fill={BODY} stroke={STROKE} strokeWidth="0.5" />
        {/* Side panels / ears */}
        <rect x="2" y="6" width="2.5" height="6" rx="1" fill={ACCENT} stroke={STROKE} strokeWidth="0.4" />
        <rect x="19.5" y="6" width="2.5" height="6" rx="1" fill={ACCENT} stroke={STROKE} strokeWidth="0.4" />
        {/* Eyes - circular with light blue iris and highlight */}
        <circle cx="9" cy="8.5" r="2" fill={EYES} stroke={STROKE} strokeWidth="0.5" />
        <circle cx="15" cy="8.5" r="2" fill={EYES} stroke={STROKE} strokeWidth="0.5" />
        <circle cx="9.5" cy="8" r="0.4" fill="white" />
        <circle cx="15.5" cy="8" r="0.4" fill="white" />
        {/* Nose / sensors */}
        <circle cx="11" cy="10" r="0.4" fill={STROKE} />
        <circle cx="13" cy="10" r="0.4" fill={STROKE} />
        {/* Mouth - closed line or open oval; white for visibility */}
        {mouthOpen ? (
          <ellipse cx="12" cy="11.5" rx="2.5" ry="1.8" fill="white" />
        ) : (
          <line x1="10" y1="11.5" x2="14" y2="11.5" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
        )}
        {/* Neck */}
        <rect x="11" y="13.5" width="2" height="1" fill={BODY} stroke={STROKE} strokeWidth="0.3" />
        {/* Torso - rounded rect */}
        <rect x="5" y="14.5" width="14" height="7" rx="2" fill={BODY} stroke={STROKE} strokeWidth="0.5" />
        {/* Chest panel */}
        <rect x="9" y="15.5" width="6" height="3" rx="1" fill={ACCENT} stroke={STROKE} strokeWidth="0.4" />
        <circle cx="11" cy="17" r="0.35" fill={STROKE} />
        <circle cx="13" cy="17" r="0.35" fill={STROKE} />
      </g>
    </svg>
  );
}
