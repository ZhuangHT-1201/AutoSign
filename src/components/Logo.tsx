interface LogoProps {
  compact?: boolean;
  inverse?: boolean;
}

export function Logo({ compact = false, inverse = false }: LogoProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${inverse ? 'brand--inverse' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" fill="none">
          <rect x="6" y="8" width="32" height="30" rx="10" fill="currentColor" opacity=".15" />
          <path d="M14 7v5M30 7v5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="11" y="10" width="22" height="22" rx="6" stroke="currentColor" strokeWidth="2.4" />
          <path d="M11 17h22" stroke="currentColor" strokeWidth="2.4" />
          <path d="m17 24 3.2 3.2L28 20.7" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="brand__type">
          <strong>课迹</strong>
          <small>CLASSMARK</small>
        </span>
      )}
    </div>
  );
}
