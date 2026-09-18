import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '../../lib/api'
import { productsApi, type Product, type ProductInput, type ProductPage } from './api'

const PER_PAGE = 20
const STOCK = ['instock', 'outofstock', 'onbackorder']
const STATUS = ['publish', 'draft', 'pending', 'private']

const BLANK: ProductInput = {
  name: '',
  sku: '',
  regular_price: '',
  sale_price: '',
  stock_status: 'instock',
  status: 'publish',
}

/**
 * WooCommerce sends the shop's local time in date_modified and the same moment
 * in UTC in its _gmt twin, with no offset on either. Reading the UTC one is the
 * only way to render a time that is right wherever this tool is running.
 */
function modified(p: Product): string {
  const raw = p.date_modified_gmt || p.date_modified
  if (!raw) return '—'
  const at = new Date(raw.endsWith('Z') ? raw : `${raw}Z`)
  return Number.isNaN(at.getTime()) ? '—' : at.toLocaleString()
}

/** Label above a control. Six of these in the form below. */
function Field({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

export default function Products() {
  const [data, setData] = useState<ProductPage | null>(null)
  const [page, setPage] = useState(1)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  /** A product being edited, 'new' for the create form, null for neither. */
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  // One request per pause in typing rather than one per keystroke — every one
  // of these goes out to the real shop.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [typed])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await productsApi.list(page, PER_PAGE, search))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  async function trash(p: Product) {
    if (!confirm(`Move "${p.name}" to the trash?\n\nYou can restore it from WordPress.`)) return
    setError('')
    try {
      await productsApi.trash(p.id)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const pages = data?.pages ?? 1

  return (
    <section>
      <h1>Products</h1>
      <p className="mb-4 text-[13px] text-muted">
        The WooCommerce catalogue of the site set up under Settings → Connections.
      </p>

      {/* Search on the left, the one action on the right. */}
      <div className="mb-1 flex items-start gap-2.5">
        <input
          type="search"
          className="input flex-1"
          placeholder="Search products"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="btn-primary flex-none" onClick={() => setEditing('new')}>
          New product
        </button>
      </div>

      {editing && (
        <ProductForm
          product={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}

      {error && (
        <div className="card">
          <p className="text-[13px] text-danger">{error}</p>
          <p className="mt-1 text-[13px] text-muted">
            If that is about credentials, fix them under Settings → Connections.
          </p>
        </div>
      )}

      {loading && <p className="mt-4 text-[13px] text-muted">Loading…</p>}

      {!loading && !error && data && data.items.length === 0 && (
        <p className="mt-4 text-[13px] text-muted">
          {search ? 'No product matches that.' : 'This shop has no products yet.'}
        </p>
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-muted">
                <th className="w-[34%] py-2">Product</th>
                <th className="py-2">Price</th>
                <th className="py-2">Stock</th>
                <th className="py-2">Status</th>
                <th className="py-2">Modified</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-b border-line align-top last:border-b-0">
                  <td className="py-2.5">
                    <button
                      className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-fg hover:text-accent"
                      onClick={() => setEditing(p)}
                    >
                      {p.name || '(no name)'}
                    </button>
                    {p.sku && <em className="mt-0.5 block text-xs text-muted">SKU {p.sku}</em>}
                  </td>
                  <td className="py-2.5">{p.price || '—'}</td>
                  <td className="py-2.5 text-[13px] text-muted">{p.stock_status}</td>
                  <td className="py-2.5 text-[13px] text-muted">{p.status}</td>
                  <td className="py-2.5 text-[13px] text-muted">{modified(p)}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      className="btn ml-1.5 px-2.5 py-0.5 text-[13px]"
                      onClick={() => setEditing(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn ml-1.5 px-2.5 py-0.5 text-[13px] text-danger"
                      onClick={() => trash(p)}
                    >
                      Trash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3.5 flex items-center justify-between gap-2.5">
            <button
              className="btn px-3.5 py-1 text-[13px]"
              disabled={page <= 1}
              onClick={() => setPage((n) => n - 1)}
            >
              ← Previous
            </button>
            <span className="text-[13px] text-muted">
              Page {data.page} of {pages} · {data.total} products
            </span>
            <button
              className="btn px-3.5 py-1 text-[13px]"
              disabled={page >= pages}
              onClick={() => setPage((n) => n + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product: Product | 'new'
  onSaved: () => void | Promise<void>
  onCancel: () => void
}) {
  const creating = product === 'new'
  const [values, setValues] = useState<ProductInput>(
    creating
      ? BLANK
      : {
          name: product.name ?? '',
          sku: product.sku ?? '',
          regular_price: product.regular_price ?? '',
          sale_price: product.sale_price ?? '',
          stock_status: product.stock_status || 'instock',
          status: product.status || 'publish',
        },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof ProductInput, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  async function save() {
    setBusy(true)
    setError('')
    try {
      if (creating) await productsApi.create(values)
      else await productsApi.update(product.id, values)
      await onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>{creating ? 'New product' : `Edit: ${product.name}`}</h2>
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
        <Field label="Name" className="col-span-full">
          <input
            className="input"
            value={values.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="SKU">
          <input
            className="input"
            value={values.sku ?? ''}
            onChange={(e) => set('sku', e.target.value)}
          />
        </Field>

        <Field label="Regular price">
          <input
            className="input"
            value={values.regular_price ?? ''}
            placeholder="19.90"
            onChange={(e) => set('regular_price', e.target.value)}
          />
        </Field>

        <Field label="Sale price">
          <input
            className="input"
            value={values.sale_price ?? ''}
            placeholder="leave empty for none"
            onChange={(e) => set('sale_price', e.target.value)}
          />
        </Field>

        <Field label="Stock">
          <select
            className="input"
            value={values.stock_status}
            onChange={(e) => set('stock_status', e.target.value)}
          >
            {STOCK.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            className="input"
            value={values.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : creating ? 'Create' : 'Save changes'}
        </button>
        <button className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>
    </div>
  )
}
