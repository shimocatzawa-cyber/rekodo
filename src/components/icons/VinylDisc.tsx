interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function VinylDisc({ size = 24, color = "#0d0d0d", accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="0.75"/>
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="0.75"/>
      <circle cx="12" cy="12" r="4" fill={accent}/>
      <circle cx="12" cy="12" r="1.5" fill="white"/>
    </svg>
  );
}
