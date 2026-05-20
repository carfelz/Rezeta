/* === OPTION F — START-OF-CONSULTATION GATE ================================
   Before opening the SOAP form at all, the doctor sees a one-screen
   "What is this consultation?" gate. Picking a reason auto-launches
   the matching protocol; the rest of the flow is the protocol-first
   walker. Forces protocol consideration but with a 2-second cost. */
const OptionGate = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader rightSlot={
        <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-n-600)', background: 'transparent', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Saltar y abrir consulta vacía</button>
      }/>
      <div style={{flex: 1, padding: '32px 28px', overflow: 'auto'}}>
        <div style={{maxWidth: 880, margin: '0 auto'}}>
          <div style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Paso 1 de 2 · ¿Qué traes hoy?</div>
          <h2 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26, color: 'var(--color-n-900)', margin: '0 0 6px', letterSpacing: '-0.01em'}}>Comencemos con el motivo</h2>
          <p style={{fontSize: 13.5, color: 'var(--color-n-500)', margin: 0, marginBottom: 24, maxWidth: 580}}>
            Elige un motivo o protocolo. La consulta se abrirá pre-armada y los campos SOAP se llenarán automáticamente. Tarda 2 segundos.
          </p>

          {/* Quick-pick from patient history */}
          <div style={{marginBottom: 24}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 10}}>Para Isabel · sus consultas anteriores</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10}}>
              {[
                {icon: 'ph-heartbeat', title: 'Seguimiento HTA', sub: 'Última: hace 3 meses · v2', primary: true, badge: 'Más probable'},
                {icon: 'ph-pulse', title: 'Control DM tipo 2', sub: 'Última: hace 6 meses · v1'},
                {icon: 'ph-stethoscope', title: 'Consulta general', sub: 'Sin protocolo guía'},
              ].map((c, i) => (
                <div key={i} style={{padding: '14px 16px', background: '#fff', border: c.primary ? '2px solid var(--color-p-500)' : '1px solid var(--color-n-200)', borderRadius: 6, cursor: 'pointer', position: 'relative'}}>
                  {c.badge && <span style={{position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{c.badge}</span>}
                  <i className={`ph ${c.icon}`} style={{fontSize: 20, color: c.primary ? 'var(--color-p-500)' : 'var(--color-n-500)'}}/>
                  <div style={{fontSize: 13.5, color: 'var(--color-n-900)', fontWeight: 500, marginTop: 8}}>{c.title}</div>
                  <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search / browse */}
          <div style={{marginBottom: 18}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 10}}>O elige otro protocolo</div>
            <div style={{position: 'relative', marginBottom: 10}}>
              <i className="ph ph-magnifying-glass" style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-n-400)'}}/>
              <div style={{height: 38, paddingLeft: 36, paddingRight: 12, border: '1px solid var(--color-n-200)', borderRadius: 5, fontSize: 13, color: 'var(--color-n-400)', display: 'flex', alignItems: 'center', background: '#fff'}}>Buscar entre tus 34 protocolos…</div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8}}>
              {[
                ['ph-heart', 'Cardiovascular', 8],
                ['ph-pulse', 'Endocrinología', 5],
                ['ph-lungs', 'Respiratorio', 4],
                ['ph-brain', 'Salud mental', 3],
                ['ph-baby', 'Pediatría', 7],
                ['ph-first-aid', 'Urgencias', 7],
              ].map(([icon, name, count]) => (
                <div key={name} style={{padding: '10px 14px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10}}>
                  <i className={`ph ${icon}`} style={{fontSize: 14, color: 'var(--color-n-500)'}}/>
                  <span style={{fontSize: 12.5, color: 'var(--color-n-700)', flex: 1}}>{name}</span>
                  <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-400)'}}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skip */}
          <div style={{padding: '14px 16px', background: 'transparent', border: '1px dashed var(--color-n-200)', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 12}}>
            <i className="ph ph-arrow-bend-up-right" style={{fontSize: 16, color: 'var(--color-n-400)'}}/>
            <div style={{flex: 1}}>
              <div style={{fontSize: 12.5, color: 'var(--color-n-700)'}}>¿No encaja ningún protocolo?</div>
              <div style={{fontSize: 11.5, color: 'var(--color-n-500)'}}>Abre la consulta en blanco. Podrás añadir protocolo después.</div>
            </div>
            <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Continuar sin protocolo</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OptionGate = OptionGate;
