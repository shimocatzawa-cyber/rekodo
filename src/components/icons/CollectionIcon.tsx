interface Props {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

export default function CollectionIcon({ size = 24, color = "#0d0d0d", accent: _accent = "#CC5500", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Three album spines standing upright on a shelf */}
      <rect x="2.75" y="4" width="5" height="16" rx="0.5" stroke={color} strokeWidth="1.5"/>
      <rect x="9.5" y="6" width="5" height="14" rx="0.5" stroke={color} strokeWidth="1.5"/>
      <rect x="16.25" y="3" width="5" height="17" rx="0.5" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}
