interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function ShareIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Container / tray */}
      <rect x="3" y="13" width="18" height="8" rx="1" stroke={color} strokeWidth="1.5"/>
      {/* Arrow shaft going up out of the tray */}
      <line x1="12" y1="3" x2="12" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Arrowhead */}
      <path d="M8 7 L12 3 L16 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
