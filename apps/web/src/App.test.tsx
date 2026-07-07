import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renderiza o título', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /marombas tracker/i })).toBeTruthy()
  })
})
