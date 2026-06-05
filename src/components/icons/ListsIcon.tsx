interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function ListsIcon({ size = 24, color = "#0d0d0d", accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Row 1 — accent position marker */}
      <circle cx="4" cy="6" r="2" fill={accent}/>
      <line x1="9" y1="6" x2="22" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Row 2 */}
      <circle cx="4" cy="12" r="2" stroke={color} strokeWidth="1.25"/>
      <line x1="9" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Row 3 */}
      <circle cx="4" cy="18" r="2" stroke={color} strokeWidth="1.25"/>
      <line x1="9" y1="18" x2="22" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
