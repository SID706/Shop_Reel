import {
  CircleUserRound,
  Heart,
  House,
  Plus,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'

type NavigationItem = {
  labelKey: 'feed' | 'wishlist' | 'create' | 'bag' | 'me'
  to: string
  icon: LucideIcon
}

const items: NavigationItem[] = [
  { labelKey: 'feed', to: '/', icon: House },
  { labelKey: 'wishlist', to: '/wishlist', icon: Heart },
  { labelKey: 'create', to: '/create', icon: Plus },
  { labelKey: 'bag', to: '/bag', icon: ShoppingBag },
  { labelKey: 'me', to: '/me', icon: CircleUserRound },
]

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:mx-auto md:max-w-md"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ labelKey, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  aria-hidden="true"
                  className={cn('size-5', isActive && 'stroke-[2.5]')}
                />
                <span>{t(`nav.${labelKey}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
