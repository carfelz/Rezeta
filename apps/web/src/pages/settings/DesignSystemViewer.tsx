import { Link } from 'react-router-dom'

interface Props {
  title: string
  description: string
  src: string
}

export function DesignSystemViewer({ title, description, src }: Props): JSX.Element {
  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          flexShrink: 0,
        }}
      >
        <Link
          to="/ajustes"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 13,
            color: 'var(--color-n-500)',
            textDecoration: 'none',
          }}
        >
          <i className="ph ph-caret-left" style={{ fontSize: 14 }} />
          Ajustes
        </Link>
        <i className="ph ph-caret-right" style={{ fontSize: 12, color: 'var(--color-n-300)' }} />
        <span style={{ fontSize: 13, color: 'var(--color-n-700)', fontWeight: 500 }}>{title}</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 12,
            color: 'var(--color-p-500)',
            textDecoration: 'none',
            marginLeft: 'auto',
          }}
        >
          <i className="ph ph-arrow-square-out" style={{ fontSize: 14 }} />
          Abrir en pestaña
        </a>
      </div>

      {/* Title row */}
      <div style={{ marginBottom: 'var(--space-4)', flexShrink: 0 }}>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-1)' }}>
          {title}
        </h1>
        <p className="text-body-sm" style={{ color: 'var(--color-n-500)', margin: 0 }}>
          {description}
        </p>
      </div>

      {/* iframe — height accounts for topbar (56px) + page padding (64px) + breadcrumb + title rows (~120px) */}
      <div
        style={{
          border: 'var(--border-default)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          height: 'calc(100vh - 56px - 64px - 120px)',
          minHeight: 480,
          flexShrink: 0,
        }}
      >
        <iframe
          src={src}
          title={title}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
