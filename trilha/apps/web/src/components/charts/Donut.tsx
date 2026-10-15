import { Cell, Pie, PieChart } from 'recharts'
import { pct } from '../../lib/utils'
import { BAD, OK } from './theme'

export function Donut({ hits, misses, size = 120, thickness = 14 }: { hits: number; misses: number; size?: number; thickness?: number }) {
  const total = hits + misses
  const data = total
    ? [
        { name: 'Acertos', value: hits, color: OK },
        { name: 'Erros', value: misses, color: BAD },
      ]
    : [{ name: 'Sem questões', value: 1, color: 'var(--app-surface-2)' }]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={size / 2 - thickness}
          outerRadius={size / 2}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={size >= 110 ? 'text-2xl font-semibold tabular' : 'text-base font-semibold tabular'}>{pct(hits, total)}%</span>
      </div>
    </div>
  )
}
