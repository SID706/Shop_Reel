type LegalKind = 'terms' | 'privacy' | 'affiliate-disclosure' | 'grievance'

const content: Record<LegalKind, { title: string; summary: string }> = {
  terms: { title: 'Terms of Service', summary: 'These Terms of Service govern your use of ShopReel.' },
  privacy: { title: 'Privacy Policy', summary: 'This Privacy Policy explains how ShopReel handles account and service data.' },
  'affiliate-disclosure': { title: 'Affiliate Disclosure', summary: 'Creators may earn a commission when you buy through an affiliate link.' },
  grievance: { title: 'Grievance Policy', summary: 'Contact ShopReel support to report content or raise a service grievance.' },
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const { title, summary } = content[kind]
  return <main className="mx-auto min-h-dvh max-w-md p-6"><a className="text-sm text-primary" href="/">Back to ShopReel</a><h1 className="mt-8 text-2xl font-semibold">{title}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{summary}</p></main>
}
