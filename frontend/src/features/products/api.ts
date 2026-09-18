import { request } from '../../lib/api'

/** Only the fields the screen shows — see FIELDS in the backend's core.py. */
export type Product = {
  id: number
  name: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  stock_status: string
  stock_quantity: number | null
  status: string
  permalink: string
  date_modified: string
  date_modified_gmt: string
}

export type ProductPage = {
  items: Product[]
  page: number
  per_page: number
  total: number
  pages: number
}

export type ProductInput = {
  name?: string
  sku?: string
  regular_price?: string
  sale_price?: string
  stock_status?: string
  status?: string
}

export const productsApi = {
  list: (page: number, perPage: number, search: string) => {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage), search })
    return request<ProductPage>(`/products?${q}`)
  },
  create: (values: ProductInput) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(values) }),
  update: (id: number, values: ProductInput) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(values) }),
  // Trashes rather than destroys — the backend decides, see delete_product.
  trash: (id: number) => request<Product>(`/products/${id}`, { method: 'DELETE' }),
}
