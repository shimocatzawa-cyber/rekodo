interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function AddRecordIcon({ size = 24, color = "#0d0d0d", accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Outer vinyl edge */}
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.5"/>
      {/* Groove ring */}
      <circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth="0.75"/>
      {/* Center label — filled accent */}
      <circle cx="12" cy="12" r="4.5" fill={accent}/>
      {/* Plus sign in white over accent */}
      <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
