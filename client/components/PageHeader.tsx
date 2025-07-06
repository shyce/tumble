interface PageHeaderProps {
  title?: string
  subtitle?: string
  compact?: boolean
}

export default function PageHeader({ title, subtitle, compact = false }: PageHeaderProps) {
  if (!title && !subtitle) return null

  return (
    <div className={compact ? "mb-6 text-center" : "mb-8"}>
      {title && (
        <h1 className={`font-bold text-slate-900 mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text ${
          compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
        }`}>
          {title}
        </h1>
      )}
      {subtitle && (
        <p className={`text-slate-600 ${compact ? "text-base" : "text-lg max-w-3xl"}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}