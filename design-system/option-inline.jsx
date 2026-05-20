/* === OPTION E — INLINE COMMAND/SLASH ======================================
   Doctors stay in SOAP fields. Typing "/" inside any field opens a popup
   with matching protocols and protocol fragments — pulls the chunk inline.
   Familiar fields, zero new vocabulary, fastest for power-users.
   This artboard captures the moment the popup is open. */
const OptionInline = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader/>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '20px 28px', overflow: 'auto'}}>
        <div>
          <SOAPCard title="Motivo de consulta">
            <FieldGhost multiline value="Seguimiento HTA. Cefaleas ocasionales, PA en casa 145/92."/>
          </SOAPCard>
          <SOAPCard title="Signos vitales">
            <VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98'}}/>
          </SOAPCard>
          <SOAPCard title="Subjetivo">
            <FieldGhost multiline value="Cefaleas ocasionales 2 semanas. Adherencia parcial — olvida dosis nocturna."/>
          </SOAPCard>

          {/* Active field with cursor + slash popup */}
          <div style={{background: '#fff', border: '1px solid var(--color-p-300)', borderRadius: 5, padding: '14px 18px 16px', marginBottom: 12, position: 'relative', boxShadow: '0 0 0 3px var(--color-p-50)'}}>
            <div style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--color-n-900)', marginBottom: 8}}>Evaluación</div>
            <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55, position: 'relative'}}>
              HTA estadio 1, PA fuera de meta 148/94.
              <span style={{display: 'inline-block', position: 'relative'}}>
                <span style={{color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 12}}>/hta</span>
                <span style={{display: 'inline-block', width: 1, height: 14, background: 'var(--color-n-900)', verticalAlign: 'middle', marginLeft: 1, animation: 'blink 1s steps(2) infinite'}}/>

                {/* Slash popup */}
                <div style={{position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 420, background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 6, boxShadow: '0 1px 0 rgba(14,14,13,0.04), 0 8px 24px -8px rgba(14,14,13,0.18), 0 2px 6px rgba(14,14,13,0.06)', zIndex: 5, overflow: 'hidden'}}>
                  <div style={{padding: '10px 14px', borderBottom: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 8}}>
                    <i className="ph ph-magnifying-glass" style={{fontSize: 13, color: 'var(--color-n-400)'}}/>
                    <span style={{fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-n-700)'}}>/hta</span>
                    <span style={{flex: 1}}/>
                    <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)'}}>↑↓ navegar · ↵ insertar</span>
                  </div>
                  <div style={{padding: '6px 0'}}>
                    <div style={{padding: '4px 14px', fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>Protocolos · 2 coincidencias</div>
                    {[
                      {icon: 'ph-list-checks', title: 'HTA — Seguimiento', sub: 'Algoritmo · evaluación + tabla farmacológica · 8 pasos', selected: true},
                      {icon: 'ph-list-checks', title: 'HTA — Crisis hipertensiva', sub: 'Decisión · clasificación + manejo agudo · 6 pasos'},
                    ].map((p, i) => (
                      <div key={i} style={{padding: '8px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, background: p.selected ? 'var(--color-p-50)' : 'transparent', borderLeft: p.selected ? '2px solid var(--color-p-500)' : '2px solid transparent'}}>
                        <i className={`ph ${p.icon}`} style={{fontSize: 14, color: p.selected ? 'var(--color-p-700)' : 'var(--color-n-500)', marginTop: 2}}/>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontSize: 12.5, color: 'var(--color-n-900)', fontWeight: p.selected ? 500 : 400}}>{p.title}</div>
                          <div style={{fontSize: 11, color: 'var(--color-n-500)', marginTop: 1}}>{p.sub}</div>
                        </div>
                        {p.selected && <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', background: '#fff', border: '1px solid var(--color-n-200)', padding: '1px 5px', borderRadius: 3}}>↵</kbd>}
                      </div>
                    ))}
                    <div style={{padding: '4px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginTop: 4}}>Fragmentos</div>
                    {[
                      {icon: 'ph-quotes', title: 'Texto: meta y primera línea', sub: 'Pega cita del protocolo HTA en este campo'},
                      {icon: 'ph-pill', title: 'Tabla farmacológica HTA', sub: 'Inserta tabla en Plan + cola de receta'},
                      {icon: 'ph-flask', title: 'Laboratorio: química renal + perfil lipídico', sub: 'Añade orden de laboratorio'},
                    ].map((f, i) => (
                      <div key={i} style={{padding: '7px 14px', display: 'flex', alignItems: 'flex-start', gap: 10}}>
                        <i className={`ph ${f.icon}`} style={{fontSize: 13, color: 'var(--color-n-500)', marginTop: 2}}/>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontSize: 12.5, color: 'var(--color-n-700)'}}>{f.title}</div>
                          <div style={{fontSize: 11, color: 'var(--color-n-500)', marginTop: 1}}>{f.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{padding: '8px 14px', borderTop: '1px solid var(--color-n-100)', background: 'var(--color-n-25)', fontSize: 11, color: 'var(--color-n-500)', display: 'flex', alignItems: 'center', gap: 12}}>
                    <span><kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, padding: '0 4px', border: '1px solid var(--color-n-200)', borderRadius: 2, background: '#fff'}}>/</kbd> en cualquier campo</span>
                    <span>·</span>
                    <span>tipea para filtrar</span>
                  </div>
                </div>
              </span>
            </div>
            <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
          </div>

          <SOAPCard title="Plan">
            <FieldGhost multiline height={50} placeholder='Tip: tipea "/" para insertar fragmento de protocolo…'/>
          </SOAPCard>
        </div>

        <div>
          <div style={{marginBottom: 14}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
              <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
            </div>
          </div>
          <div style={{padding: '12px 14px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Atajos rápidos</div>
            {[
              ['/', 'Buscar protocolo o fragmento'],
              ['/hta', 'HTA seguimiento'],
              ['/dm2', 'Diabetes tipo 2'],
              ['/lab', 'Plantilla de laboratorio'],
              ['/rx', 'Plantilla de receta'],
            ].map(([k, v]) => (
              <div key={k} style={{display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12}}>
                <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '1px 6px', border: '1px solid var(--color-n-200)', borderRadius: 3, background: 'var(--color-n-25)', color: 'var(--color-n-700)', minWidth: 36, textAlign: 'center'}}>{k}</kbd>
                <span style={{color: 'var(--color-n-600)'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OptionInline = OptionInline;
