import type { ComponentType } from 'react'
import Home from '../pages/Home'
import Settings from '../pages/Settings'
import Products from './products/Page'

/**
 * The sidebar is this list, in this order. One folder per tab:
 *
 *     features/<name>/
 *         Page.tsx   the screen
 *         api.ts     this feature's calls, built on request() from lib/api
 *
 * Adding a tab: copy `example-one`, rename, add a line here, and add the
 * matching folder under `backend/app/features/`.
 *
 * Home and Settings live in pages/ because they belong to the shell rather
 * than to any one feature — they still appear here so there is exactly one
 * place that decides what the sidebar shows.
 */
export type Tab = {
  id: string
  label: string
  Page: ComponentType
}

export const TABS: Tab[] = [
  { id: 'home', label: 'Home', Page: Home },
  { id: 'products', label: 'Products', Page: Products },
  { id: 'settings', label: 'Settings', Page: Settings },
]
