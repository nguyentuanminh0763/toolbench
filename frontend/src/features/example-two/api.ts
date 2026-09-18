import { request } from '../../lib/api'

export type Result = {
  characters: number
  words: number
  unique_words: number
}

export const exampleTwoApi = {
  process: (text: string) =>
    request<Result>('/example-two/process', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
}
