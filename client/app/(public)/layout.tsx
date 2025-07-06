import MainNavigation from '@/components/MainNavigation'

interface PublicLayoutProps {
  children: React.ReactNode
}

function getGradientColors() {
  return 'from-slate-50 via-teal-50 to-emerald-50'
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className={`min-h-screen bg-gradient-to-br ${getGradientColors()}`}>
      <MainNavigation />
      {children}
    </div>
  )
}