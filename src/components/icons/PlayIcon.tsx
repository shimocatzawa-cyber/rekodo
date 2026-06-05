interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function PlayIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M6 4 L6 20 L21 12 Z" fill={color} strokeLinejoin="round"/>
    </svg>
  );
}
