interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function DigIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Collection box */}
      <rect x="3" y="13" width="18" height="8" rx="1" stroke={color} strokeWidth="1.5"/>
      {/* Divider inside box */}
      <line x1="12" y1="13" x2="12" y2="21" stroke={color} strokeWidth="0.75"/>
      {/* Downward arrow — the "dig" motion */}
      <line x1="12" y1="3" x2="12" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 9 L12 13 L16 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
