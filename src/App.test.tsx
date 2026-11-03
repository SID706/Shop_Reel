import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Phase 1 app shell', () => {
  it('renders the mobile navigation labels', () => {
    render(<App />)

    expect(screen.getByText('shop')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chats' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })
})
