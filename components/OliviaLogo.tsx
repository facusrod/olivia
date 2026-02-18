interface OliviaLogoProps {
  size?: number;
  className?: string;
}

export default function OliviaLogo({ size = 40, className = '' }: OliviaLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      {/* Oliva body (O) */}
      <ellipse cx="30" cy="36" rx="16" ry="20" transform="rotate(-8 30 36)" stroke="currentColor" strokeWidth="4.5" fill="none" />
      {/* Stem / I stroke */}
      <path d="M33 16 L31 42" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      {/* Leaf */}
      <path d="M33 16 C38 8, 50 6, 52 10 C54 14, 44 18, 33 16Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
