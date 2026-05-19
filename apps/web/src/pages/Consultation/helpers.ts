export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatKicker(iso: string, location: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time} · ${location}`
}
