/** Concentric rings mark — matches approved negative-space mockup */
export function BrandMark({
  className,
  title = "DoBetterMoney",
}: {
  className?: string
  title?: string
}) {
  return (
    <img
      src="/brand-mark.png"
      alt={title}
      width={40}
      height={40}
      className={className}
      draggable={false}
    />
  )
}
