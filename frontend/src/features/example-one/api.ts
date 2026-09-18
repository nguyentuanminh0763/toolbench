import { request } from '../../lib/api'

/** This feature's calls and types. Nothing else imports from here. */

export type Summary = {
  title: string
  rows: { label: string; value: string }[]
}

export const exampleOneApi = {
  summary: () => request<Summary>('/example-one/summary'),
}
