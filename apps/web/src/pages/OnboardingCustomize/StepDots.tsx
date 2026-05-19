export function StepDots({ current }: { current: 1 | 2 }): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2].map((n) => (
        <div
          key={n}
          className={`w-2 h-2 rounded-full ${n === current ? 'bg-p-500' : 'bg-n-300'}`}
        />
      ))}
      <span className="text-caption text-n-500 ml-2">{current === 1 ? 'Plantillas' : 'Tipos'}</span>
    </div>
  )
}
