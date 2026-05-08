/**
 * Shared style strings using CSS variables.
 * Import and use in component templates to keep styles consistent
 * and theme-aware across the app.
 */

export const S = {
  // ─── Layout ───────────────────────────────────────────────────────────────
  page: 'p-6 max-w-5xl mx-auto',

  // ─── Cards / surfaces ─────────────────────────────────────────────────────
  card: 'rounded-xl border p-5',
  cardStyle: 'background-color: var(--bg-surface); border-color: var(--border)',

  // ─── Inputs ───────────────────────────────────────────────────────────────
  input: 'w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
  inputStyle: 'background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)',

  select: 'rounded-lg px-3 py-1.5 text-sm border transition-colors focus:outline-none focus:ring-2 cursor-pointer',
  selectStyle: 'background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary)',

  // ─── Buttons ──────────────────────────────────────────────────────────────
  btnPrimary: 'text-sm font-medium rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimaryStyle: 'background-color: var(--accent); color: var(--accent-fg)',

  btnGhost: 'text-sm rounded-lg px-3 py-1.5 transition-colors cursor-pointer',
  btnGhostStyle: 'color: var(--text-secondary)',

  btnDanger: 'text-sm font-medium rounded-lg px-3 py-1.5 transition-colors cursor-pointer',
  btnDangerStyle: 'background-color: var(--danger); color: #fff',

  // ─── Table ────────────────────────────────────────────────────────────────
  table: 'w-full text-sm',
  tableWrapper: 'rounded-xl border overflow-hidden',
  tableWrapperStyle: 'border-color: var(--border)',
  th: 'text-left text-xs uppercase tracking-wider px-4 py-3 font-medium',
  thStyle: 'color: var(--text-muted); background-color: var(--table-header-bg); border-color: var(--table-border)',
  td: 'px-4 py-3',
  tr: 'border-b last:border-0 transition-colors',
  trStyle: 'border-color: var(--table-border)',

  // ─── Labels ───────────────────────────────────────────────────────────────
  label: 'text-xs font-medium uppercase tracking-wider',
  labelStyle: 'color: var(--text-muted)',

  // ─── Badges ───────────────────────────────────────────────────────────────
  badge: 'inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium',

  // ─── Modals ───────────────────────────────────────────────────────────────
  modalBackdrop: 'fixed inset-0 flex items-center justify-center z-50 px-4',
  modalBackdropStyle: 'background-color: var(--bg-overlay)',
  modal: 'rounded-xl border p-6 max-w-sm w-full',
  modalStyle: 'background-color: var(--bg-surface); border-color: var(--border)',

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  skeleton: 'rounded-xl animate-pulse skeleton',
} as const;
