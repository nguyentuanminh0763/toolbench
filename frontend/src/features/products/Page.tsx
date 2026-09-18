import { useCallback, useEffect, useState } from 'react'
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
      <p className="muted">
        The WooCommerce catalogue of the site set up under Settings → Connections.
      </p>

      <div className="toolbar">
        <input
          type="search"
          className="searchbox"
          placeholder="Search products"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="primary" onClick={() => setEditing('new')}>
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
          <p className="error">{error}</p>
          <p className="muted inline">
            If that is about credentials, fix them under Settings → Connections.
          </p>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}

      {!loading && !error && data && data.items.length === 0 && (
        <p className="muted">{search ? 'No product matches that.' : 'This shop has no products yet.'}</p>
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <table className="table products">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Modified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="rowname" onClick={() => setEditing(p)}>
                      {p.name || '(no name)'}
                    </button>
                    {p.sku && <em className="hint">SKU {p.sku}</em>}
                  </td>
                  <td>{p.price || '—'}</td>
                  <td className="muted inline">{p.stock_status}</td>
                  <td className="muted inline">{p.status}</td>
                  <td className="muted inline">{modified(p)}</td>
                  <td className="actions">
                    <button className="plain" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button className="plain danger" onClick={() => trash(p)}>
                      Trash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button className="plain" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              ← Previous
            </button>
            <span className="muted inline">
              Page {data.page} of {pages} · {data.total} products
            </span>
            <button className="plain" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
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
      <div className="grid">
        <label className="field full">
          <span className="label">Name</span>
          <input value={values.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </label>

        <label className="field">
          <span className="label">SKU</span>
          <input value={values.sku ?? ''} onChange={(e) => set('sku', e.target.value)} />
        </label>

        <label className="field">
          <span className="label">Regular price</span>
          <input
            value={values.regular_price ?? ''}
            placeholder="19.90"
            onChange={(e) => set('regular_price', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Sale price</span>
          <input
            value={values.sale_price ?? ''}
            placeholder="leave empty for none"
            onChange={(e) => set('sale_price', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Stock</span>
          <select value={values.stock_status} onChange={(e) => set('stock_status', e.target.value)}>
            {STOCK.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">Status</span>
          <select value={values.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row">
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : creating ? 'Create' : 'Save changes'}
        </button>
        <button className="plain" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  )
}
