interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function WantlistIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Bookmark ribbon */}
      <path
        d="M6 3 H18 V21 L12 17 L6 21 Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Small vinyl circle on bookmark face */}
      <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="0.75"/>
      <circle cx="12" cy="10" r="1" fill={color}/>
    </svg>
  );
}
