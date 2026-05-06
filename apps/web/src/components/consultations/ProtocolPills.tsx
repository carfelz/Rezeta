import { TabRail, TabRailItem, TabRailAdd } from '@/components/ui'

export interface ProtocolPill {
  id: string
  title: string
  completed: number
  total: number
  isActive: boolean
}

export interface ProtocolPillsProps {
  pills: ProtocolPill[]
  onSelect: (id: string) => void
  onAdd: () => void
  showAdd?: boolean
}

export function ProtocolPills({
  pills,
  onSelect,
  onAdd,
  showAdd = true,
}: ProtocolPillsProps): JSX.Element {
  return (
    <TabRail>
      {pills.map((pill) => (
        <TabRailItem
          key={pill.id}
          active={pill.isActive}
          meta={`${pill.completed}/${pill.total}`}
          onClick={() => onSelect(pill.id)}
        >
          {pill.title}
        </TabRailItem>
      ))}
      {showAdd && <TabRailAdd onClick={onAdd}>Añadir protocolo</TabRailAdd>}
    </TabRail>
  )
}
