/* === OPTION D — SIDE-BY-SIDE PROTOCOL WALKER ==============================
   Persistent left protocol stepper, right SOAP form. Ticking a step in
   the protocol injects content into the matching SOAP field. Familiar
   layout, but protocol is impossible to ignore. */
const OptionWalker = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader/>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 260px', gap: 0, overflow: 'hidden'}}>

        {/* Left: protocol walker */}
        <div style={{borderRight: '1px solid var(--color-n-100)', background: '#fff', overflow: 'auto'}}>
          <div style={{padding: '14px 18px', borderBottom: '1px solid var(--color-n-100)', position: 'sticky', top: 0, background: '#fff', zIndex: 1}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 4}}>Protocolo activo</div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
              <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--color-n-900)', margin: 0, flex: 1}}>HTA — Seguimiento</h3>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 5px', borderRadius: 3}}>v2</span>
            </div>
            <div style={{marginTop: 8, height: 4, background: 'var(--color-n-100)', borderRadius: 2, overflow: 'hidden'}}>
              <div style={{width: '62%', height: '100%', background: 'var(--color-p-500)'}}/>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--color-n-500)'}}>
              <span>5 de 8 pasos</span>
              <span style={{fontFamily: 'var(--font-mono)'}}>~ 3 min restantes</span>
            </div>
          </div>

          <div style={{padding: '8px 0'}}>
            {[
              {n: 1, label: 'Motivo de consulta', target: 'Motivo', status: 'done'},
              {n: 2, label: 'Tomar signos vitales', target: 'Vitales', status: 'done'},
              {n: 3, label: 'Anamnesis dirigida', target: 'Subjetivo', status: 'done', items: ['Adherencia a tratamiento', 'Síntomas cardiovasculares', 'Estilo de vida']},
              {n: 4, label: 'Examen físico cardiovascular', target: 'Examen', status: 'done', items: ['Auscultación cardiaca', 'Auscultación pulmonar', 'Edema MMII', 'Pulsos periféricos']},
              {n: 5, label: 'Decisión: ¿alcanza meta PA?', target: 'Evaluación', status: 'active'},
              {n: 6, label: 'Tabla de medicación', target: 'Plan · Receta', status: 'next'},
              {n: 7, label: 'Educación al paciente', target: 'Plan', status: 'next'},
              {n: 8, label: 'Programar seguimiento', target: 'Plan', status: 'next'},
            ].map(s => (
              <div key={s.n} style={{padding: '10px 18px', borderLeft: s.status === 'active' ? '2px solid var(--color-p-500)' : '2px solid transparent', background: s.status === 'active' ? 'var(--color-p-50)' : 'transparent'}}>
                <div style={{display: 'flex', alignItems: 'flex-start', gap: 10}}>
                  <div style={{width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.status === 'done' ? 'var(--color-p-500)' : (s.status === 'active' ? '#fff' : 'transparent'), border: s.status === 'done' ? '1.5px solid var(--color-p-500)' : (s.status === 'active' ? '1.5px solid var(--color-p-500)' : '1.5px solid var(--color-n-300)')}}>
                    {s.status === 'done' && <i className="ph ph-check" style={{fontSize: 10, color: '#fff'}}/>}
                    {s.status === 'active' && <span style={{width: 6, height: 6, background: 'var(--color-p-500)', borderRadius: '50%'}}/>}
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 13, color: s.status === 'next' ? 'var(--color-n-500)' : 'var(--color-n-800)', fontWeight: s.status === 'active' ? 500 : 400, lineHeight: 1.35}}>{s.label}</div>
                    <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2}}>→ {s.target}</div>
                    {s.items && s.status === 'done' && (
                      <div style={{marginTop: 6, paddingLeft: 2}}>
                        {s.items.map(it => (
                          <div key={it} style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--color-n-500)', padding: '2px 0'}}>
                            <i className="ph ph-check" style={{fontSize: 10, color: 'var(--color-p-500)'}}/>{it}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: SOAP form, populated */}
        <div style={{padding: '20px 24px', overflow: 'auto'}}>
          <SOAPCard title="Subjetivo" accent sub="Llenado por el paso 3 del protocolo">
            <FieldGhost multiline value="Cefaleas ocasionales en últimas 2 semanas, sin disnea ni dolor torácico. Adherencia a Losartán parcial — olvida dosis nocturna. Niega cambios en estilo de vida."/>
          </SOAPCard>
          <SOAPCard title="Examen físico" accent sub="4 de 4 hallazgos del protocolo">
            <FieldGhost multiline value="Ruidos cardiacos rítmicos, sin soplos. MV conservado bilateralmente. Sin edema de MMII. Pulsos periféricos simétricos y palpables."/>
          </SOAPCard>
          <SOAPCard title="Evaluación" accent sub="Paso 5 · en curso">
            <div style={{padding: '8px 12px', background: 'var(--color-p-50)', border: '1px solid var(--color-p-100)', borderRadius: 4, fontSize: 12, color: 'var(--color-p-900)', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8}}>
              <i className="ph ph-arrow-right" style={{fontSize: 12, color: 'var(--color-p-500)', marginTop: 2}}/>
              <span><strong>Decisión activa:</strong> ¿paciente alcanza meta PA &lt;130/80? — Tomado: <strong>148/94</strong>. Algoritmo sugiere agregar BCC.</span>
            </div>
            <FieldGhost multiline placeholder="Escribe tu evaluación o usa la sugerencia del algoritmo…"/>
          </SOAPCard>
          <SOAPCard title="Plan">
            <FieldGhost multiline height={50} placeholder="Se llenará al completar pasos 6–8…"/>
          </SOAPCard>
        </div>

        {/* Right rail */}
        <div style={{borderLeft: '1px solid var(--color-n-100)', padding: '20px 16px', overflow: 'auto'}}>
          <div style={{marginBottom: 18}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
              <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
            </div>
          </div>
          <div>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Órdenes</div>
            <div style={{padding: '10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4, fontSize: 12}}>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--color-n-700)'}}><span>Receta · 2 fármacos</span><i className="ph ph-arrow-right" style={{fontSize: 11, color: 'var(--color-n-400)'}}/></div>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--color-n-500)'}}><span>Laboratorio</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11}}>—</span></div>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--color-n-500)'}}><span>Imagen</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11}}>—</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OptionWalker = OptionWalker;
