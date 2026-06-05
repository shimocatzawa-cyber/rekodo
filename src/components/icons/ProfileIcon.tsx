interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function ProfileIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M4 21 C4 17 7.5 14.5 12 14.5 C16.5 14.5 20 17 20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
