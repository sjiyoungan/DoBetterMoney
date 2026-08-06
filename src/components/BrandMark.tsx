/** Concentric rings mark — negative space, no filled tile */
export function BrandMark({
  className,
  title = "DoBetterMoney",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {/* Outer ring — gap at ~7–8 o'clock */}
      <path
        d="M10.2 24.1a11 11 0 1 0-1.35-2.05"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      {/* Inner ring — open on the left */}
      <path
        d="M12.4 21.35a6.85 6.85 0 1 0-.55-1.55"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
