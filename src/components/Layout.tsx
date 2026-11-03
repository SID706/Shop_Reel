import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto min-h-dvh w-full max-w-md pb-20">
        <header className="border-b border-border px-5 py-5">
          <p className="text-lg font-semibold tracking-tight">{t('appName')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('shell.tagline')}
          </p>
        </header>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
