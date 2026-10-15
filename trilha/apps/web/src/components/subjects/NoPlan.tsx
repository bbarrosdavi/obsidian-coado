import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { Card, Empty } from '../ui'

/** Estado vazio exibido quando não há plano ativo */
export function NoPlan() {
  return (
    <Card>
      <Empty
        icon={<FolderOpen size={36} />}
        title="Nenhum plano ativo"
        action={
          <Link to="/planos" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Ir para Planos
          </Link>
        }
      >
        Crie ou selecione um plano de estudos para começar.
      </Empty>
    </Card>
  )
}
