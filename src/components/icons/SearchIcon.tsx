interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function SearchIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" stroke={color} strokeWidth="1.5"/>
      <line x1="16" y1="16" x2="21.5" y2="21.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
