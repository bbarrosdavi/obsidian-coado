import { useId } from 'react'
import { clsx } from '../lib/utils'

/*
 * Ilustrações das telas de entrada, boas-vindas e conta. Mesmo traço "feito à mão" de art.tsx: contorno na
 * cor da tinta, preenchimentos nas variáveis de cor (brand-* e --app-*), então seguem a paleta e o modo
 * claro/noturno escolhidos. Tema de estudo, sem relação com café.
 */

type ArtProps = { className?: string; title?: string }

const ink = 'var(--app-ink)'
const stroke = { stroke: ink, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const

/** id seguro para clipPath/gradiente (useId do React traz caracteres que não servem em url(#…)) */
const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

const SUBJECT_COLORS = ['#e8a598', '#f2cf8a', '#9cc3a0', '#a9bde0', '#c9b1d9', '#e4c7a8']

/** Mesa de estudo junto à janela, de noite, com chuva: a cena da tela de entrada */
export function DeskSceneArt({ className, title = 'Mesa de estudo junto à janela' }: ArtProps) {
  const clip = useSvgId('janela')
  return (
    <svg viewBox="0 0 480 440" className={clsx('block', className)} role="img" aria-label={title}>
      <defs>
        <clipPath id={clip}>
          <rect x="70" y="40" width="250" height="200" rx="14" />
        </clipPath>
      </defs>
      {/* janela com céu, lua e chuva */}
      <rect x="70" y="40" width="250" height="200" rx="14" fill="var(--color-brand-800)" />
      <g clipPath={`url(#${clip})`}>
        <circle cx="262" cy="92" r="22" fill="var(--color-brand-100)" />
        <circle cx="272" cy="86" r="20" fill="var(--color-brand-800)" />
        {[100, 134, 168, 202, 236, 270, 304].map((x, i) => (
          <path
            key={x}
            d={`M${x} 40l-10 26`}
            stroke="var(--color-brand-200)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
            className="animate-rain"
            style={{ animationDelay: `${(i % 4) * 0.27}s` }}
          />
        ))}
        {[[120, 70], [150, 120], [212, 64], [190, 150]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="var(--color-brand-100)" opacity="0.8" />
        ))}
      </g>
      <rect x="70" y="40" width="250" height="200" rx="14" {...stroke} />
      <path d="M195 40v200M70 140h250" {...stroke} strokeOpacity="0.6" />
      {/* prateleira com livros */}
      <path d="M352 120h96" {...stroke} />
      {[[356, 'var(--color-brand-600)', 36], [370, 'var(--app-ok)', 30], [384, 'var(--color-brand-300)', 40], [400, '#a9bde0', 28]].map(([x, c, h]) => (
        <g key={String(x)}>
          <rect x={Number(x)} y={120 - Number(h)} width="12" height={Number(h)} rx="2" fill={String(c)} />
          <rect x={Number(x)} y={120 - Number(h)} width="12" height={Number(h)} rx="2" {...stroke} strokeWidth={1.6} />
        </g>
      ))}
      <path d="M420 120l14-30l8 3l-14 30" {...stroke} fill="var(--color-brand-200)" strokeWidth={1.6} />
      {/* mesa */}
      <rect x="40" y="300" width="400" height="16" rx="5" fill="var(--color-brand-600)" />
      <rect x="40" y="300" width="400" height="16" rx="5" {...stroke} />
      <path d="M66 316v96M414 316v96" {...stroke} strokeWidth={3} />
      {/* luminária */}
      <path d="M342 300L360 248L332 222" {...stroke} strokeWidth={3} />
      <path d="M310 226l26-18l16 24z" fill="var(--color-brand-500)" />
      <path d="M310 226l26-18l16 24z" {...stroke} />
      <path d="M326 232L284 300h84z" fill="var(--color-brand-200)" opacity="0.35" className="animate-pulse" />
      <rect x="330" y="294" width="32" height="7" rx="3.5" fill="var(--color-brand-700)" />
      {/* caderno aberto e lápis */}
      <path d="M150 296q38-14 76 0q38-14 76 0v6q-38-14-76 0q-38-14-76 0z" fill="var(--app-surface)" />
      <path d="M150 296q38-14 76 0q38-14 76 0v6q-38-14-76 0q-38-14-76 0zM226 296v6" {...stroke} />
      <path d="M166 290q22-6 44 0M166 284q22-6 44 0M242 290q22-6 44 0M242 284q22-6 34 0" {...stroke} strokeOpacity="0.35" strokeWidth={1.5} />
      <path d="M296 270l-26 24" stroke="var(--app-warn)" strokeWidth="5" strokeLinecap="round" />
      <path d="M296 270l-26 24" {...stroke} strokeWidth={1.2} />
      {/* planta */}
      <path d="M86 300h36l-4 -30h-28z" fill="var(--color-brand-300)" />
      <path d="M86 300h36l-4 -30h-28z" {...stroke} />
      <path d="M104 270c0-16-6-28-18-34c12 0 20 10 18 34zM104 270c0-18 6-32 20-38c0 14-6 26-20 38z" fill="var(--app-ok)" opacity="0.85" />
      <path d="M104 270c0-16-6-28-18-34M104 270c0-18 6-32 20-38" {...stroke} />
    </svg>
  )
}

/** Anel que vai se completando: progresso da apresentação e do carregamento */
export function ProgressRing({ level, className }: { level: number; className?: string }) {
  const l = Math.max(0, Math.min(1, level))
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className={clsx('block', className)} role="img" aria-label={`${Math.round(l * 100)}% concluído`}>
      <circle cx="60" cy="60" r={r} fill="var(--app-surface)" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-brand-600)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - l)}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.4,1.4,.6,1)' }}
      />
      <circle cx="60" cy="60" r={r + 6} {...stroke} strokeOpacity="0.25" />
      <path
        d="M47 61l9 9l18-20"
        {...stroke}
        strokeWidth={4}
        stroke="var(--color-brand-600)"
        style={{ opacity: l >= 1 ? 1 : 0, transition: 'opacity 600ms' }}
      />
    </svg>
  )
}

/** Fichários com abas coloridas: planos e disciplinas */
export function SubjectsArt({ className, title = 'Fichários das disciplinas' }: ArtProps) {
  return (
    <svg viewBox="0 0 160 130" className={clsx('block', className)} role="img" aria-label={title}>
      <ellipse cx="78" cy="122" rx="56" ry="5" fill={ink} opacity="0.08" />
      {SUBJECT_COLORS.slice(0, 4).map((c, i) => (
        <g key={c} className="animate-float" style={{ animationDelay: `${i * 0.6}s` }}>
          <rect x={30 + i * 6} y={34 + i * 18} width="96" height="64" rx="8" fill={c} transform={`rotate(${i % 2 ? 3 : -3} 78 ${66 + i * 18})`} />
          <rect x={30 + i * 6} y={34 + i * 18} width="96" height="64" rx="8" {...stroke} transform={`rotate(${i % 2 ? 3 : -3} 78 ${66 + i * 18})`} />
        </g>
      ))}
      <rect x="48" y="96" width="60" height="12" rx="3" {...stroke} fill="var(--app-surface)" strokeWidth={1.5} />
      <path d="M56 102h36" {...stroke} strokeOpacity="0.5" />
    </svg>
  )
}

/** Cronômetro: estudar com o tempo contando e registrar no fim */
export function TimerArt({ className, title = 'Cronômetro' }: ArtProps) {
  return (
    <svg viewBox="0 0 140 140" className={clsx('block', className)} role="img" aria-label={title}>
      <ellipse cx="70" cy="132" rx="42" ry="5" fill={ink} opacity="0.08" />
      <rect x="62" y="12" width="16" height="10" rx="3" {...stroke} fill="var(--color-brand-600)" />
      <path d="M96 30l8-8" {...stroke} strokeWidth={3} />
      <circle cx="70" cy="76" r="48" fill="var(--app-surface)" />
      <circle cx="70" cy="76" r="48" {...stroke} />
      <path d="M70 76V28a48 48 0 0 1 41.6 72z" fill="var(--color-brand-200)" opacity="0.8" />
      <circle cx="70" cy="76" r="48" {...stroke} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <path key={i} d={`M${70 + Math.sin(a) * 40} ${76 - Math.cos(a) * 40}L${70 + Math.sin(a) * 44} ${76 - Math.cos(a) * 44}`} {...stroke} strokeOpacity="0.5" />
      })}
      <g className="animate-spin-slow" style={{ transformOrigin: '70px 76px' }}>
        <path d="M70 76V40" {...stroke} strokeWidth={3} stroke="var(--color-brand-700)" />
      </g>
      <circle cx="70" cy="76" r="4" fill={ink} />
    </svg>
  )
}

/** Ciclo de disciplinas girando: a sequência que se repete */
export function CycleArt({ className, title = 'Ciclo de estudos' }: ArtProps) {
  return (
    <svg viewBox="0 0 140 140" className={clsx('block', className)} role="img" aria-label={title}>
      <circle cx="70" cy="70" r="44" {...stroke} strokeDasharray="4 7" strokeOpacity="0.45" />
      <g className="animate-spin-slow" style={{ transformOrigin: '70px 70px' }}>
        {SUBJECT_COLORS.map((c, i) => {
          const a = (i / SUBJECT_COLORS.length) * Math.PI * 2 - Math.PI / 2
          return (
            <g key={c}>
              <circle cx={70 + Math.cos(a) * 44} cy={70 + Math.sin(a) * 44} r="10" fill={c} />
              <circle cx={70 + Math.cos(a) * 44} cy={70 + Math.sin(a) * 44} r="10" {...stroke} strokeWidth={1.6} />
            </g>
          )
        })}
      </g>
      <path d="M57 70a13 13 0 1 1 4 9.5" {...stroke} />
      <path d="M57 63v7h7" {...stroke} />
    </svg>
  )
}

/** Calendário com dias marcados: revisões espaçadas */
export function CalendarArt({ className, title = 'Calendário de revisões' }: ArtProps) {
  const marks = new Set([1, 8, 16])
  return (
    <svg viewBox="0 0 150 130" className={clsx('block', className)} role="img" aria-label={title}>
      <ellipse cx="72" cy="122" rx="52" ry="5" fill={ink} opacity="0.08" />
      <rect x="18" y="20" width="110" height="96" rx="10" fill="var(--app-surface)" />
      <rect x="18" y="20" width="110" height="24" rx="10" fill="var(--color-brand-600)" />
      <rect x="18" y="20" width="110" height="96" rx="10" {...stroke} />
      <path d="M18 44h110" {...stroke} />
      <path d="M42 12v14M104 12v14" {...stroke} strokeWidth={3} />
      {Array.from({ length: 20 }, (_, i) => {
        const x = 30 + (i % 5) * 20
        const y = 54 + Math.floor(i / 5) * 15
        return marks.has(i) ? (
          <g key={i}>
            <circle cx={x + 2} cy={y + 3} r="7" fill="var(--color-brand-200)" />
            <path d={`M${x - 2} ${y + 3}l3 3l6-7`} {...stroke} strokeWidth={1.8} />
          </g>
        ) : (
          <circle key={i} cx={x + 2} cy={y + 3} r="1.8" fill={ink} opacity="0.25" />
        )
      })}
      <path d="M32 57c20-14 26 18 50 6s20 14 30 20" {...stroke} strokeDasharray="3 5" strokeOpacity="0.5" />
      <g className="animate-float">
        <circle cx="128" cy="104" r="15" fill="var(--color-brand-100)" />
        <circle cx="128" cy="104" r="15" {...stroke} />
        <path d="M121 104a7 7 0 1 0 2-5" {...stroke} />
        <path d="M121 97v5h5" {...stroke} />
      </g>
    </svg>
  )
}

/** Gráfico de barras subindo: estatísticas e simulados */
export function ChartArt({ className, title = 'Gráfico de desempenho' }: ArtProps) {
  const bars = [40, 62, 34, 82]
  return (
    <svg viewBox="0 0 150 130" className={clsx('block', className)} role="img" aria-label={title}>
      <path d="M14 116h124" {...stroke} />
      <path d="M14 116V20" {...stroke} strokeOpacity="0.4" />
      {bars.map((h, i) => (
        <g key={i} className="animate-pop" style={{ animationDelay: `${i * 0.12}s` }}>
          <rect x={26 + i * 28} y={116 - h} width="20" height={h} rx="4" fill={i % 2 ? 'var(--color-brand-300)' : 'var(--color-brand-600)'} />
          <rect x={26 + i * 28} y={116 - h} width="20" height={h} rx="4" {...stroke} strokeWidth={1.6} />
        </g>
      ))}
      <path d="M30 80l28-18l28 30l32-58" {...stroke} stroke="var(--app-ok)" strokeWidth={2.5} />
      <path d="M110 32l8 2l-1 8" {...stroke} stroke="var(--app-ok)" strokeWidth={2.5} />
    </svg>
  )
}

/** Envelope com papéis e um selo de "feito": conta, perfil e arquivos */
export function FilesArt({ className, title = 'Envelope com seus arquivos' }: ArtProps) {
  return (
    <svg viewBox="0 0 150 130" className={clsx('block', className)} role="img" aria-label={title}>
      <ellipse cx="75" cy="122" rx="54" ry="5" fill={ink} opacity="0.08" />
      <g className="animate-float">
        <rect x="34" y="18" width="52" height="66" rx="4" fill="var(--app-surface)" transform="rotate(-8 60 50)" />
        <rect x="34" y="18" width="52" height="66" rx="4" {...stroke} transform="rotate(-8 60 50)" />
        <path d="M42 34h30M42 42h36M42 50h24" {...stroke} strokeOpacity="0.4" transform="rotate(-8 60 50)" />
      </g>
      <g className="animate-float" style={{ animationDelay: '1.2s' }}>
        <rect x="66" y="14" width="50" height="64" rx="4" fill="var(--color-brand-50)" transform="rotate(7 90 46)" />
        <rect x="66" y="14" width="50" height="64" rx="4" {...stroke} transform="rotate(7 90 46)" />
        <rect x="74" y="24" width="18" height="22" rx="2" fill="#e8a598" transform="rotate(7 90 46)" />
        <text x="76" y="40" fontSize="8" fontWeight="800" fill={ink} transform="rotate(7 90 46)">
          PDF
        </text>
        <path d="M74 56h30M74 64h22" {...stroke} strokeOpacity="0.4" transform="rotate(7 90 46)" />
      </g>
      <path d="M20 58h110v54a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill="var(--app-kraft)" />
      <path d="M20 58l55 34l55-34" fill="var(--color-brand-200)" />
      <path d="M20 58h110v54a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6zM20 58l55 34l55-34" {...stroke} />
      <path d="M20 118l42-32M130 118l-42-32" {...stroke} strokeOpacity="0.35" />
      <circle cx="112" cy="100" r="11" fill="var(--color-brand-600)" />
      <circle cx="112" cy="100" r="11" {...stroke} />
      <path d="M107 100l3.5 3.5l6.5-7" stroke="var(--color-brand-100)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
