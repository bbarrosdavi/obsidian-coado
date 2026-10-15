export const BRAND = '#96663b'
export const OK = '#6f9a73'
export const BAD = '#c96f6b'

export const axisProps = {
  stroke: 'var(--app-line)',
  tick: { fill: 'var(--app-muted)', fontSize: 11 },
  tickLine: false,
}

export const gridProps = {
  stroke: 'var(--app-line)',
  strokeDasharray: '3 3',
  vertical: false,
}

export const tooltipProps = {
  contentStyle: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-line)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--app-ink)',
  },
  labelStyle: { color: 'var(--app-ink)', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'var(--app-ink)' },
  cursor: { fill: 'var(--app-surface-2)' },
}

/** segundos → horas com 2 casas (para eixos de gráficos) */
export const toHours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100

/** horas → "2,5h" */
export const fmtHours = (hours: number) => `${(Math.round(hours * 10) / 10).toString().replace('.', ',')}h`
