import { useId } from 'react';
import artwork from '@/data/brandArtwork.json';

interface BrandLogoProps {
  className?: string;
  variant?: 'horizontal' | 'stacked' | 'mark';
  tone?: 'default' | 'inverse';
  label?: string;
}

/** True vector artwork: transparent at every size, with no bitmap or font download
 * needed for the compass. Unique IDs keep multiple instances independent.
 */
export default function BrandLogo({ className = 'w-44', variant = 'horizontal', tone = 'default', label = 'Specialty Match' }: BrandLogoProps) {
  const id = useId().replace(/:/g, '');
  const gradientId = `brand-gradient-${id}`;
  const needleId = `brand-needle-${id}`;
  const inverse = tone === 'inverse';
  const markSize = variant === 'stacked' ? 156 : variant === 'mark' ? 100 : 64;

  return (
    <svg
      data-brand-logo={variant}
      data-brand-tone={tone}
      role="img"
      aria-label={label}
      focusable="false"
      viewBox={variant === 'horizontal' ? '0 0 354 64' : variant === 'mark' ? artwork.markViewBox : '0 0 354 218'}
      className={`block h-auto max-w-full shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="2" y1="65" x2="98" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor={artwork.blue} />
          <stop offset="1" stopColor={artwork.teal} />
        </linearGradient>
        <mask id={needleId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path d={`${artwork.northPath} ${artwork.southPath}`} fill="white" />
          <circle cx="49" cy="50" r="4" fill="black" />
        </mask>
      </defs>
      <svg x={variant === 'stacked' ? 99 : 0} y="0" width={markSize} height={markSize} viewBox={artwork.markViewBox} aria-hidden="true">
        <path d={artwork.ringPath} fill={`url(#${gradientId})`} />
        <g mask={`url(#${needleId})`}>
          <path d={artwork.northPath} fill={artwork.teal} />
          <path d={artwork.southPath} fill={artwork.blue} />
        </g>
      </svg>
      {variant !== 'mark' && (
        <text
          x={variant === 'stacked' ? 2 : 78}
          y={variant === 'stacked' ? 207 : 44}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={variant === 'stacked' ? 42 : 34}
          fontWeight="600"
          letterSpacing="-1.1"
          textLength={variant === 'stacked' ? 350 : 274}
          lengthAdjust="spacingAndGlyphs"
          aria-hidden="true"
        >
          <tspan fill={inverse ? '#ffffff' : artwork.wordBlue}>Specialty</tspan>
          <tspan fill={inverse ? '#5eead4' : artwork.wordTeal}> Match</tspan>
        </text>
      )}
    </svg>
  );
}
