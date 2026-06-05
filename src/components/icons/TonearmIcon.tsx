interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function TonearmIcon({ size = 24, color = "#0d0d0d", accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Pivot bearing housing */}
      <circle cx="18" cy="5" r="2.5" stroke={color} strokeWidth="1.5"/>
      {/* S-shaped arm: from counterweight end, through pivot, to headshell */}
      <path
        d="M21 2.5 L18 5 C16 8 14 10 12 12.5 C10 15 8 16.5 6.5 18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Counterweight */}
      <circle cx="21" cy="2.5" r="1.5" fill={color}/>
      {/* Stylus tip — accent */}
      <circle cx="6.5" cy="18" r="1.25" fill={accent}/>
    </svg>
  );
}
