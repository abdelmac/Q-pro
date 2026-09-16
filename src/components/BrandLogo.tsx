import artworkGeometry from '@/data/brandArtwork.json';

/** The supplied artwork is kept byte-for-byte; viewports only control its layout.
 * The compact lockup uses the original compass and lettering, never retyped text.
 * BASE_URL works both under GitHub Pages /Q-pro/ and the relative mobile build.
 */
const logoUrl = `${import.meta.env?.BASE_URL ?? '/'}branding/specialty-match-logo.png`;

interface BrandLogoProps {
  className?: string;
  variant?: 'horizontal' | 'stacked' | 'mark';
  label?: string;
}

export default function BrandLogo({ className = 'w-44', variant = 'horizontal', label = 'Specialty Match' }: BrandLogoProps) {
  const artwork = <image href={logoUrl} width={artworkGeometry.width} height={artworkGeometry.height} />;
  return (
    <svg
      data-brand-logo={variant}
      role="img"
      aria-label={label}
      focusable="false"
      viewBox={variant === 'horizontal' ? '0 0 354 64' : variant === 'mark' ? artworkGeometry.markViewBox : '100 282 1054 688'}
      className={`block h-auto max-w-full shrink-0 mix-blend-multiply ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {variant === 'horizontal' ? <>
        <svg x="0" y="0" width="64" height="64" viewBox={artworkGeometry.markViewBox} overflow="hidden" aria-hidden="true">{artwork}</svg>
        <svg x="78" y="11" width="276" height="42" viewBox="100 808 1054 162" overflow="hidden" aria-hidden="true">{artwork}</svg>
      </> : artwork}
    </svg>
  );
}
