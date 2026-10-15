import type { DateStr } from '../../lib/types'
import { clsx, monthShort, weekdayShort } from '../../lib/utils'

/** Selo de data: 11 / OUT/26 / SÁB */
export function DateBadge({ date, className }: { date: DateStr; className?: string }) {
  return (
    <div
      className={clsx(
        'flex w-14 shrink-0 flex-col items-center rounded-xl bg-brand-50 py-1.5 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300',
        className,
      )}
    >
      <span className="text-lg font-bold leading-none tabular">{date.slice(8, 10)}</span>
      <span className="mt-1 text-[10px] font-semibold leading-none">
        {monthShort(date)}/{date.slice(2, 4)}
      </span>
      <span className="mt-0.5 text-[10px] leading-tight text-muted">{weekdayShort(date)}</span>
    </div>
  )
}
