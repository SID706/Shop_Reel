import { useTranslation } from 'react-i18next'

type PlaceholderPageProps = {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <section className="flex min-h-[calc(100dvh-7.25rem)] items-center justify-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('shell.comingSoon')}
        </p>
      </div>
    </section>
  )
}
