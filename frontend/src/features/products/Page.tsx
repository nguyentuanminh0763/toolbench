import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '../../lib/api'
import { toast } from '../../lib/toast'
import { productsApi, type Product, type ProductInput, type ProductPage } from './api'
import {
  Package,
  Plus,
  Search,
  X,
  ExternalLink,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

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

function formatPrice(val: string | number | undefined | null): string {
  if (!val && val !== 0) return '—'
  const clean = String(val).trim()
  const num = Number(clean)
  if (Number.isNaN(num)) return clean
  if (num >= 1000 && num % 1 === 0) {
    return num.toLocaleString('vi-VN') + ' ₫'
  }
  return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatIdleTime(p: Product): { text: string; full: string; alertClass: string } {
  const raw = p.date_modified_gmt || p.date_modified
  if (!raw) return { text: '—', full: 'No data', alertClass: 'text-muted' }
  const at = new Date(raw.endsWith('Z') ? raw : `${raw}Z`)
  if (Number.isNaN(at.getTime())) return { text: '—', full: 'Invalid date', alertClass: 'text-muted' }

  const now = new Date()
  const diffMs = Math.max(0, now.getTime() - at.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffHours = Math.floor(diffSec / 3600)
  const diffDays = Math.floor(diffHours / 24)

  const dateStr = at.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const full = `Modified: ${dateStr} (${diffDays} days idle)`

  if (diffHours < 1) {
    return { text: 'Just now', full, alertClass: 'text-emerald-500 font-medium' }
  }
  if (diffHours < 24) {
    return { text: `${diffHours}h ago`, full, alertClass: 'text-emerald-500 font-medium' }
  }
  if (diffDays === 1) {
    return { text: '1d ago', full, alertClass: 'text-muted' }
  }
  if (diffDays < 30) {
    return {
      text: `${diffDays}d ago`,
      full,
      alertClass: diffDays > 14 ? 'text-amber-500/90 font-medium' : 'text-muted',
    }
  }

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    const remainDays = diffDays % 30
    const text = remainDays >= 5 ? `${diffMonths}mo ${remainDays}d ago` : `${diffMonths}mo ago`
    return {
      text,
      full,
      alertClass: diffMonths >= 3 ? 'text-amber-500 font-medium' : 'text-muted',
    }
  }

  const years = Math.floor(diffDays / 365)
  const remainMonths = Math.floor((diffDays % 365) / 30)
  const text = remainMonths > 0 ? `${years}y ${remainMonths}mo ago` : `${years}y ago`
  return {
    text,
    full,
    alertClass: 'text-rose-500/90 font-medium',
  }
}

function formatExactDate(p: Product): { text: string; full: string } {
  const raw = p.date_modified_gmt || p.date_modified
  if (!raw) return { text: '—', full: '—' }
  const at = new Date(raw.endsWith('Z') ? raw : `${raw}Z`)
  if (Number.isNaN(at.getTime())) return { text: '—', full: '—' }

  const text = at.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const idle = formatIdleTime(p)
  return { text, full: `${text} (idle: ${idle.text})` }
}

function getInitials(name: string): string {
  if (!name) return 'PR'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  const hues = [220, 260, 280, 310, 160, 190, 35]
  const sum = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue = hues[sum % hues.length]
  return `hsl(${hue}, 70%, 45%)`
}

function FormField({
  label,
  className = '',
  help,
  children,
}: {
  label: string
  className?: string
  help?: string
  children: ReactNode
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-fg">
        {label}
        {help && (
          <span className="text-[11px] font-normal text-muted" title={help}>
            {help}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

export default function Products() {
  const [data, setData] = useState<ProductPage | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  type SortOrder = 'none' | 'oldest' | 'newest'
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [dateMode, setDateMode] = useState<'exact' | 'idle'>(() => {
    return (localStorage.getItem('toolbench_date_mode') as 'exact' | 'idle') || 'idle'
  })

  const toggleDateMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDateMode((prev) => {
      const next = prev === 'exact' ? 'idle' : 'exact'
      localStorage.setItem('toolbench_date_mode', next)
      toast.info(
        next === 'idle'
          ? 'Format: Idle Time (bỏ ngỏ)'
          : 'Format: Modified Date (ngày giờ cụ thể)',
        2000,
      )
      return next
    })
  }

  const toggleSortOrder = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSortOrder((prev) => {
      let next: SortOrder
      if (prev === 'none') {
        next = 'oldest'
        toast.info('Sorted: Most idle first (bỏ ngỏ lâu nhất lên đầu)', 2200)
      } else if (prev === 'oldest') {
        next = 'newest'
        toast.info('Sorted: Recently modified first (mới cập nhật lên đầu)', 2200)
      } else {
        next = 'none'
        toast.info('Sort cleared: Default order', 2000)
      }
      return next
    })
    setPage(1)
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [typed])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const orderby = sortOrder === 'none' ? 'date' : 'modified'
      const order = sortOrder === 'oldest' ? 'asc' : 'desc'
      setData(
        await productsApi.list(
          page,
          perPage,
          search,
          orderby,
          order,
          statusFilter,
          stockFilter,
        ),
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, sortOrder, statusFilter, stockFilter])

  useEffect(() => {
    load()
  }, [load])

  async function handleTrash(p: Product) {
    setDeletingBusy(true)
    try {
      await productsApi.trash(p.id)
      toast.success(`Moved "${p.name || 'Product'}" to WordPress trash.`)
      setDeletingProduct(null)
      await load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e)
      toast.error(msg)
      setError(msg)
    } finally {
      setDeletingBusy(false)
    }
  }

  const getTime = (p: Product) => {
    const raw = p.date_modified_gmt || p.date_modified
    if (!raw) return 0
    const t = new Date(raw.endsWith('Z') ? raw : `${raw}Z`).getTime()
    return Number.isNaN(t) ? 0 : t
  }

  const sortedItems = [...(data?.items ?? [])].sort((a, b) => {
    if (sortOrder === 'oldest') {
      // Oldest date first = largest idle time at top
      return getTime(a) - getTime(b)
    }
    if (sortOrder === 'newest') {
      // Newest date first = recently modified at top
      return getTime(b) - getTime(a)
    }
    return 0
  })

  const pages = data?.pages ?? 1

  return (
    <div className="flex flex-col gap-4">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-fg tracking-tight">Products Catalog</h1>
            {data && (
              <span className="badge bg-accent/10 text-accent border border-accent/20 text-xs">
                {data.total} total
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            WooCommerce items synchronized via your configured WordPress connection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="btn text-xs py-1.5 px-2.5"
            title="Reload products"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-accent' : 'text-muted'}`} />
            <span>Reload</span>
          </button>

          <button
            className="btn-primary text-xs py-1.5 px-3"
            onClick={() => setEditing('new')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-line bg-card shadow-xs">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            type="search"
            className="input pl-8.5 pr-7 text-xs py-1.5"
            placeholder="Search by product name or SKU..."
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {typed && (
            <button
              onClick={() => setTyped('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-0.5 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter dropdowns & Rows per page */}
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1.5 px-2 w-auto"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">All Stock</option>
            <option value="instock">In Stock</option>
            <option value="outofstock">Out of Stock</option>
            <option value="onbackorder">Backordered</option>
          </select>

          <select
            className="input text-xs py-1.5 px-2 w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">All Status</option>
            <option value="publish">Published</option>
            <option value="draft">Draft</option>
            <option value="private">Private</option>
          </select>

          <select
            className="input text-xs py-1.5 px-2 w-auto font-medium"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(1)
            }}
            title="Products per page"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-xl border border-danger/30 bg-danger/5 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-danger flex-none mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-semibold text-danger">Failed to fetch WooCommerce catalog</h3>
            <p className="mt-0.5 text-xs text-danger/80">{error}</p>
            <p className="mt-1 text-xs text-muted">
              Check your WordPress site URL and Application Password under Settings → Connections.
            </p>
          </div>
        </div>
      )}

      {/* Compact Data Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-soft/60 text-muted font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-2.5 px-3.5 w-[42%]">Product Details</th>
                <th className="py-2.5 px-3 w-[16%]">Price</th>
                <th className="py-2.5 px-3 w-[13%]">Stock</th>
                <th className="py-2.5 px-3 w-[11%]">Status</th>
                <th className="py-2.5 px-3 w-[14%] select-none">
                  <div className="flex items-center gap-1.5">
                    {/* Title button: click toggles between Idle Time and Modified */}
                    <button
                      type="button"
                      onClick={toggleDateMode}
                      className="font-semibold uppercase tracking-wider text-[11px] text-muted hover:text-accent cursor-pointer transition-colors"
                      title="Click title to toggle format: Idle Time ↔ Modified Date"
                    >
                      {dateMode === 'idle' ? 'Idle Time' : 'Modified'}
                    </button>

                    {/* Sort button: click sorts from most idle to least idle */}
                    <button
                      type="button"
                      onClick={toggleSortOrder}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        sortOrder !== 'none'
                          ? 'bg-accent/15 text-accent'
                          : 'text-muted/50 hover:text-fg hover:bg-soft'
                      }`}
                      title={
                        sortOrder === 'oldest'
                          ? 'Sorted: Most idle first (bỏ ngỏ lâu nhất) — Click to sort newest first'
                          : sortOrder === 'newest'
                          ? 'Sorted: Recently modified first — Click to reset sort'
                          : 'Sort: Most idle first (sắp xếp từ bỏ ngỏ lâu đến gần)'
                      }
                    >
                      {sortOrder === 'oldest' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-accent stroke-[2.5]" />
                      ) : sortOrder === 'newest' ? (
                        <ArrowDown className="h-3.5 w-3.5 text-accent stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="py-2.5 px-3 w-[6%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {/* Skeleton loading rows */}
              {loading &&
                Array.from({ length: perPage }).map((_, i) => (
                  <tr key={i} className="animate-pulse h-10">
                    <td className="py-2 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-soft flex-none" />
                        <div className="h-3 w-48 rounded bg-soft" />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="h-3 w-20 rounded bg-soft" />
                    </td>
                    <td className="py-2 px-3">
                      <div className="h-4 w-16 rounded-full bg-soft" />
                    </td>
                    <td className="py-2 px-3">
                      <div className="h-4 w-14 rounded-full bg-soft" />
                    </td>
                    <td className="py-2 px-3">
                      <div className="h-3 w-20 rounded bg-soft" />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="h-6 w-12 ml-auto rounded bg-soft" />
                    </td>
                  </tr>
                ))}

              {/* Empty state */}
              {!loading && !error && sortedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-soft border border-line text-muted">
                        <Package className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-fg text-xs">No products found</span>
                      <p className="text-xs text-muted max-w-sm">
                        {search || statusFilter !== 'all' || stockFilter !== 'all'
                          ? 'Try resetting your search query or status filters.'
                          : 'Your store has no items yet. Create your first product above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data Rows - Compact 1-line layout */}
              {!loading &&
                sortedItems.map((p) => {
                  const hasDiscount = p.sale_price && p.regular_price && Number(p.sale_price) < Number(p.regular_price)
                  const isStock = p.stock_status === 'instock'
                  const isBackorder = p.stock_status === 'onbackorder'
                  const featuredImg =
                    p.image ||
                    (p.images && p.images.length > 0
                      ? typeof p.images[0] === 'string'
                        ? p.images[0]
                        : p.images[0]?.src
                      : null)

                  return (
                    <tr
                      key={p.id}
                      className="group hover:bg-soft/40 transition-colors duration-100 h-10"
                    >
                      {/* Product identity: Image/Avatar + Title + SKU in single line */}
                      <td className="py-1.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Real Product Featured Image with Monogram fallback */}
                          {featuredImg ? (
                            <img
                              src={featuredImg}
                              alt={p.name}
                              className="h-8 w-8 flex-none rounded-lg object-cover border border-line bg-card shadow-2xs"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none'
                                const sibling = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement
                                if (sibling) sibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div
                            className={`h-8 w-8 flex-none items-center justify-center rounded-lg text-white font-bold text-xs shadow-2xs ${
                              featuredImg ? 'hidden' : 'flex'
                            }`}
                            style={{ backgroundColor: getAvatarColor(p.name) }}
                          >
                            {getInitials(p.name)}
                          </div>

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              className="text-left font-medium text-xs text-fg hover:text-accent transition-colors truncate max-w-sm sm:max-w-md lg:max-w-lg cursor-pointer"
                              onClick={() => setEditing(p)}
                              title={p.name}
                            >
                              {p.name || '(Untitled Product)'}
                            </button>
                            {p.sku && (
                              <span
                                className="font-mono text-[10px] text-muted bg-soft px-1.5 py-0.2 rounded border border-line flex-none"
                                title={`SKU: ${p.sku}`}
                              >
                                {p.sku}
                              </span>
                            )}
                            {p.permalink && (
                              <a
                                href={p.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted/60 hover:text-accent p-0.5 transition-colors flex-none"
                                title="Open product on live site"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Formatted Price column */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        {hasDiscount ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                              {formatPrice(p.sale_price)}
                            </span>
                            <span className="text-[10px] line-through text-muted">
                              {formatPrice(p.regular_price)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-fg text-xs">
                            {formatPrice(p.price || p.regular_price)}
                          </span>
                        )}
                      </td>

                      {/* Stock badge */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`badge text-[11px] px-2 py-0.5 ${
                            isStock
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isBackorder
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isStock ? 'bg-emerald-500' : isBackorder ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="capitalize">{p.stock_status}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`badge text-[11px] px-2 py-0.5 capitalize ${
                            p.status === 'publish'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                              : p.status === 'draft'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-muted/10 text-muted border border-line'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Modified / Idle time */}
                      <td className="py-1.5 px-3 text-[11px] whitespace-nowrap">
                        {(() => {
                          if (dateMode === 'idle') {
                            const idle = formatIdleTime(p)
                            return (
                              <div className="flex items-center gap-1.5 cursor-help" title={idle.full}>
                                <Clock className="h-3 w-3 text-muted/70 flex-none" />
                                <span className={idle.alertClass}>{idle.text}</span>
                              </div>
                            )
                          }
                          const exact = formatExactDate(p)
                          return (
                            <div className="flex items-center gap-1.5 cursor-help" title={exact.full}>
                              <Clock className="h-3 w-3 text-muted/70 flex-none" />
                              <span className="text-muted">{exact.text}</span>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                            onClick={() => setEditing(p)}
                            title="Edit product"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            onClick={() => setDeletingProduct(p)}
                            title="Move to trash"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination Bar */}
        {data && data.items.length > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-line bg-soft/30 text-xs">
            <span className="text-muted">
              Page <span className="font-semibold text-fg">{data.page}</span> of{' '}
              <span className="font-semibold text-fg">{pages}</span> ·{' '}
              <span className="font-semibold text-fg">{data.total}</span> products total
            </span>

            <div className="flex items-center gap-2">
              <button
                className="btn text-xs py-1 px-2.5"
                disabled={page <= 1 || loading}
                onClick={() => setPage((n) => n - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
                <span>Previous</span>
              </button>

              <button
                className="btn text-xs py-1 px-2.5"
                disabled={page >= pages || loading}
                onClick={() => setPage((n) => n + 1)}
              >
                <span>Next</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Edit / Create Slide-over Drawer Modal */}
      {editing && (
        <ProductModal
          product={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}

      {/* Custom Trash Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="card w-full max-w-md p-6 shadow-xl border-line animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-danger mb-3">
              <div className="p-2 rounded-xl bg-danger/10 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-fg">Move to WordPress Trash?</h2>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to trash <strong className="text-fg">"{deletingProduct.name}"</strong>?
              This removes it from public catalog listings, but it can still be restored from your WordPress admin panel.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                className="btn text-xs"
                onClick={() => setDeletingProduct(null)}
                disabled={deletingBusy}
              >
                Cancel
              </button>
              <button
                className="btn-danger text-xs py-2 px-3.5"
                onClick={() => handleTrash(deletingProduct)}
                disabled={deletingBusy}
              >
                {deletingBusy ? 'Moving…' : 'Trash Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductModal({
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

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (creating) {
        await productsApi.create(values)
        toast.success(`Created product "${values.name || 'New Product'}" successfully.`)
      } else {
        await productsApi.update(product.id, values)
        toast.success(`Updated "${values.name || 'Product'}" successfully.`)
      }
      await onSaved()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <form
        onSubmit={save}
        className="card w-full max-w-xl p-6 shadow-2xl border-line max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-fg">
                {creating ? 'Create New Product' : `Edit Product: ${product.name}`}
              </h2>
              <span className="text-[11px] text-muted">
                {creating ? 'Add a new catalog item directly to WooCommerce' : `Item ID #${product.id}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-fg p-1 rounded-md hover:bg-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <FormField label="Product Title" help="Visible to customers">
            <input
              className="input"
              required
              placeholder="e.g. Ergonomic Mechanical Keyboard"
              value={values.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="SKU (Stock Keeping Unit)" help="Unique identifier">
              <input
                className="input font-mono"
                placeholder="e.g. KB-MECH-01"
                value={values.sku ?? ''}
                onChange={(e) => set('sku', e.target.value)}
              />
            </FormField>

            <FormField label="Publication Status">
              <select
                className="input capitalize"
                value={values.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Regular Price" help="Numbers only">
              <input
                className="input"
                placeholder="e.g. 4990000"
                value={values.regular_price ?? ''}
                onChange={(e) => set('regular_price', e.target.value)}
              />
            </FormField>

            <FormField label="Sale Price" help="Leave empty if none">
              <input
                className="input"
                placeholder="e.g. 3990000"
                value={values.sale_price ?? ''}
                onChange={(e) => set('sale_price', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Stock Status">
            <select
              className="input capitalize"
              value={values.stock_status}
              onChange={(e) => set('stock_status', e.target.value)}
            >
              {STOCK.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-2.5">
          <button type="button" className="btn text-xs" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs py-2 px-4" disabled={busy}>
            {busy ? 'Saving…' : creating ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
