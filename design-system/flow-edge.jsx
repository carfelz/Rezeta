/* Edge cases — each frame is a different tricky state.
   Uses the hybrid layout (gate + strip + SOAP) as the baseline. */
const EDGE_TITLES = [
  '01 · Saltar paso (con razón)',
  '02 · Nota fuera de protocolo',
  '03 · Cambiar protocolo a mitad',
  '04 · Multi-protocolo (HTA + DM2)',
  '05 · Paso condicional aparece',
  '06 · Validación · campo requerido faltante',
  '07 · Reanudar consulta interrumpida',
  '08 · Sin protocolo disponible',
];

const EdgeShell = ({title, kicker, children, headerRight}) => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader rightSlot={headerRight}/>
      {children}
    </div>
  </div>
);

const Strip = ({stepIdx = 4, total = 8, label = 'HTA — Seguimiento', extras}) => (
  <div style={{padding: '10px 28px', background: 'var(--color-p-50)', borderBottom: '1px solid var(--color-p-100)', display: 'flex', alignItems: 'center', gap: 12}}>
    <i className="ph ph-list-checks" style={{fontSize: 15, color: 'var(--color-p-700)'}}/>
    <div style={{fontSize: 12.5, color: 'var(--color-p-900)', fontWeight: 500}}>{label}</div>
    <div style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 220}}>
      <div style={{flex: 1, height: 3, background: 'var(--color-p-100)', borderRadius: 2, overflow: 'hidden'}}>
        <div style={{width: `${(stepIdx / total) * 100}%`, height: '100%', background: 'var(--color-p-500)'}}/>
      </div>
      <span style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-p-700)', whiteSpace: 'nowrap'}}>{stepIdx} / {total}</span>
    </div>
    {extras}
  </div>
);

const EdgeFrame = ({n}) => {
  // 01 — Skip step with reason modal
  if (n === 1) {
    return (
      <EdgeShell>
        <Strip stepIdx={3}/>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', padding: '20px 28px', gap: 20, position: 'relative'}}>
          <div>
            <SOAPCard title="Motivo" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA</div></SOAPCard>
            <SOAPCard title="Signos vitales" accent><VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98'}}/></SOAPCard>
            <SOAPCard title="Subjetivo" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Cefaleas 2 sem.</div></SOAPCard>
            <SOAPCard title="Examen físico" accent sub="Paso 4 · pendiente"><FieldGhost multiline placeholder="Documenta auscultación cardiaca, pulmonar, edema MMII, pulsos…"/></SOAPCard>
          </div>
          <RightRail showPlan={false} stepIdx={3} decisionActive={false}/>
          {/* Skip-reason modal */}
          <div style={{position: 'absolute', inset: 0, background: 'rgba(14,14,13,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{width: 460, background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 6, padding: '18px 20px', boxShadow: '0 24px 48px -16px rgba(14,14,13,0.30)'}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-warning-text)', marginBottom: 4}}>Saltar paso</div>
              <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 18, color: 'var(--color-n-900)', margin: '0 0 6px'}}>¿Por qué saltar Examen físico?</h3>
              <p style={{fontSize: 12.5, color: 'var(--color-n-500)', margin: '0 0 14px', lineHeight: 1.5}}>Quedará registrado en la consulta. El protocolo seguirá marcado como completo parcialmente.</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14}}>
                {['Paciente no cooperaba', 'No clínicamente relevante hoy', 'Paso ya documentado en visita reciente', 'Otro…'].map((r, i) => (
                  <label key={i} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: i === 1 ? '1px solid var(--color-p-500)' : '1px solid var(--color-n-200)', background: i === 1 ? 'var(--color-p-50)' : '#fff', borderRadius: 4, fontSize: 12.5, color: 'var(--color-n-700)', cursor: 'pointer'}}>
                    <span style={{width: 14, height: 14, borderRadius: '50%', border: i === 1 ? '4px solid var(--color-p-500)' : '1.5px solid var(--color-n-300)', background: '#fff'}}/>
                    {r}
                  </label>
                ))}
              </div>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                <button style={{padding: '7px 14px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Cancelar</button>
                <button style={{padding: '7px 14px', fontSize: 12, color: '#fff', background: 'var(--color-warning-text, #6E5319)', border: 'none', borderRadius: 3, fontWeight: 500}}>Saltar paso</button>
              </div>
            </div>
          </div>
        </div>
      </EdgeShell>
    );
  }

  // 02 — Off-protocol note
  if (n === 2) {
    return (
      <EdgeShell>
        <Strip stepIdx={4}/>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', padding: '20px 28px', gap: 20}}>
          <div>
            <SOAPCard title="Motivo" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA</div></SOAPCard>
            <SOAPCard title="Signos vitales" accent><VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98'}}/></SOAPCard>
            <SOAPCard title="Subjetivo" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Cefaleas 2 sem. Adherencia parcial.</div></SOAPCard>
            <SOAPCard title="Examen físico" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>RsCs rítmicos. MV conservado. Sin edema MMII.</div></SOAPCard>
            {/* Off-protocol card with distinct styling */}
            <div style={{background: '#fff', border: '1px dashed var(--color-warning-border, #DCC89A)', borderRadius: 5, padding: '14px 18px 16px', marginBottom: 12, position: 'relative'}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8}}>
                <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-warning-text, #6E5319)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--color-warning-bg, #F7F1E3)', padding: '1px 6px', borderRadius: 2}}>Fuera de protocolo</span>
                <div style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--color-n-900)'}}>Hallazgo adicional · Dolor torácico atípico</div>
              </div>
              <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>
                Paciente refiere dolor centro-torácico opresivo, episodios &lt;5min, no relacionado a esfuerzo. Sin diaforesis. Se solicita ECG y troponinas. Anexar a SOAP → Subjetivo.
              </div>
              <div style={{display: 'flex', gap: 6, marginTop: 10}}>
                <button style={{padding: '4px 9px', fontSize: 11, color: 'var(--color-n-600)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Convertir en paso</button>
                <button style={{padding: '4px 9px', fontSize: 11, color: 'var(--color-n-600)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Mover a Subjetivo</button>
                <span style={{marginLeft: 'auto', fontSize: 11, color: 'var(--color-n-500)'}}>10:42 · Dr. García</span>
              </div>
            </div>
            <button style={{padding: '8px 12px', fontSize: 12, color: 'var(--color-n-600)', background: 'transparent', border: '1px dashed var(--color-n-300)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6}}>
              <i className="ph ph-plus" style={{fontSize: 12}}/>Añadir nota fuera de protocolo
            </button>
          </div>
          <RightRail showPlan={false} stepIdx={4} decisionActive={false}/>
        </div>
      </EdgeShell>
    );
  }

  // 03 — Switch protocol mid-consultation
  if (n === 3) {
    return (
      <EdgeShell>
        <Strip stepIdx={3}/>
        <div style={{flex: 1, position: 'relative'}}>
          <div style={{padding: '20px 28px', opacity: 0.4, pointerEvents: 'none'}}>
            <SOAPCard title="Motivo" accent><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA</div></SOAPCard>
          </div>
          <div style={{position: 'absolute', inset: 0, background: 'rgba(14,14,13,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{width: 520, background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 6, padding: '20px 22px', boxShadow: '0 24px 48px -16px rgba(14,14,13,0.30)'}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-warning-text, #6E5319)', marginBottom: 4}}>Cambio de protocolo</div>
              <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 19, color: 'var(--color-n-900)', margin: '0 0 8px'}}>Cambiar HTA → Cefalea diagnóstico</h3>
              <p style={{fontSize: 12.5, color: 'var(--color-n-500)', margin: '0 0 14px', lineHeight: 1.55}}>Has completado 3 de 8 pasos. Esto es lo que pasa con el progreso actual:</p>
              <div style={{padding: '12px 14px', background: 'var(--color-n-25)', border: '1px solid var(--color-n-100)', borderRadius: 4, marginBottom: 14}}>
                {[
                  ['ph-check-circle', 'Motivo, vitales, subjetivo', 'Se conservan — son compatibles', 'success'],
                  ['ph-arrow-bend-up-right', 'Examen físico (paso 4)', 'Se mueve a "fuera de protocolo"', 'warn'],
                  ['ph-x-circle', 'Decisión, tratamiento, etc.', 'Se descartan — no aplican', 'muted'],
                ].map(([icon, k, v, tone], i) => (
                  <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0'}}>
                    <i className={`ph ${icon}`} style={{fontSize: 14, marginTop: 2, color: tone === 'success' ? 'var(--color-success-text)' : tone === 'warn' ? 'var(--color-warning-text, #6E5319)' : 'var(--color-n-400)'}}/>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 12.5, color: 'var(--color-n-800)', fontWeight: 500}}>{k}</div>
                      <div style={{fontSize: 11.5, color: 'var(--color-n-500)'}}>{v}</div>
                    </div>
                  </div>
                ))}
              </div>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-n-700)', marginBottom: 14}}>
                <input type="checkbox" defaultChecked/>Conservar borrador del protocolo HTA por 24h (puedes volver)
              </label>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                <button style={{padding: '7px 14px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Cancelar</button>
                <button style={{padding: '7px 14px', fontSize: 12, color: '#fff', background: 'var(--color-p-500)', border: 'none', borderRadius: 3, fontWeight: 500}}>Cambiar protocolo</button>
              </div>
            </div>
          </div>
        </div>
      </EdgeShell>
    );
  }

  // 04 — Multi-protocol tabs
  if (n === 4) {
    return (
      <EdgeShell>
        <div style={{padding: '8px 28px 0', background: 'var(--color-p-50)', borderBottom: '1px solid var(--color-p-100)', display: 'flex', gap: 4}}>
          {[
            {label: 'HTA — Seguimiento', step: '4/8', active: true},
            {label: 'DM2 — Control', step: '2/6', active: false},
          ].map((t, i) => (
            <div key={i} style={{padding: '8px 14px 10px', background: t.active ? '#fff' : 'transparent', borderRadius: '4px 4px 0 0', borderBottom: t.active ? 'none' : '1px solid var(--color-p-100)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
              <i className="ph ph-list-checks" style={{fontSize: 13, color: t.active ? 'var(--color-p-700)' : 'var(--color-p-700)', opacity: t.active ? 1 : 0.5}}/>
              <span style={{fontSize: 12.5, color: t.active ? 'var(--color-n-900)' : 'var(--color-n-600)', fontWeight: t.active ? 500 : 400}}>{t.label}</span>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, color: t.active ? 'var(--color-p-700)' : 'var(--color-n-400)'}}>{t.step}</span>
              {t.active && <i className="ph ph-x" style={{fontSize: 11, color: 'var(--color-n-400)', marginLeft: 4}}/>}
            </div>
          ))}
          <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-p-700)', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6}}>
            <i className="ph ph-plus" style={{fontSize: 11}}/>Añadir protocolo
          </button>
        </div>
        <Strip stepIdx={4} label="HTA — Seguimiento (activo)" extras={
          <span style={{marginLeft: 'auto', fontSize: 11, color: 'var(--color-p-700)', fontStyle: 'italic'}}>Vitales y SOAP se comparten entre protocolos</span>
        }/>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', padding: '20px 28px', gap: 20, overflow: 'auto'}}>
          <div>
            <SOAPCard title="Motivo" accent sub="Compartido entre 2 protocolos">
              <div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA + control de DM tipo 2. Glicemia capilar 168 ayunas hace 3 días.</div>
            </SOAPCard>
            <SOAPCard title="Signos vitales" accent sub="Compartido"><VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/></SOAPCard>
            <SOAPCard title="Subjetivo" accent>
              <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>
                Cefaleas 2 sem. Polidipsia y poliuria leves desde hace 1 mes. Adherencia parcial a Losartán y Metformina.
              </div>
            </SOAPCard>
          </div>
          <div>
            <RightRail showPlan={false} stepIdx={4} decisionActive={false}/>
            <div style={{marginTop: 16, padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 6}}>Pasos · DM2 (en pausa)</div>
              {['Motivo','HbA1c','Glicemia','Pies','Plan','Cierre'].map((s, i) => (
                <div key={s} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, color: i < 2 ? 'var(--color-n-700)' : 'var(--color-n-400)'}}>
                  <span><span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)', marginRight: 6}}>{String(i+1).padStart(2,'0')}</span>{s}</span>
                  {i < 2 && <i className="ph ph-check-circle" style={{fontSize: 12, color: 'var(--color-success-text)'}}/>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </EdgeShell>
    );
  }

  // 05 — Conditional step appears
  if (n === 5) {
    return (
      <EdgeShell>
        <Strip stepIdx={4} total={9} extras={
          <span style={{marginLeft: 'auto', fontSize: 11, color: 'var(--color-p-700)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6}}>
            <i className="ph ph-sparkle" style={{fontSize: 12}}/>Paso adicional añadido por PA &gt;160
          </span>
        }/>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', padding: '20px 28px', gap: 20, overflow: 'auto'}}>
          <div>
            <SOAPCard title="Signos vitales" accent>
              <VitalsGrid values={{pa: '168 / 102', fc: '88', t: '36.6', sat: '97', peso: '74.2', talla: '168'}}/>
              <div style={{marginTop: 8, padding: '8px 10px', background: 'var(--color-warning-bg, #F7F1E3)', border: '1px solid var(--color-warning-border, #DCC89A)', borderRadius: 4, fontSize: 12, color: 'var(--color-warning-text, #6E5319)', display: 'flex', alignItems: 'flex-start', gap: 8}}>
                <i className="ph ph-warning" style={{fontSize: 13, marginTop: 1}}/>
                <span><strong>PA ≥ 160 detectada.</strong> El protocolo añadió un paso: <strong>Descartar urgencia hipertensiva</strong> (entre vitales y subjetivo).</span>
              </div>
            </SOAPCard>
            {/* New conditional step appears with subtle highlight */}
            <div style={{background: '#fff', border: '2px solid var(--color-p-500)', borderRadius: 5, padding: '14px 18px 16px', marginBottom: 12, position: 'relative', boxShadow: '0 0 0 4px var(--color-p-50)'}}>
              <span style={{position: 'absolute', top: -10, left: 14, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#fff', background: 'var(--color-p-500)', padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.06em'}}>Paso 03 · nuevo · condicional</span>
              <div style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--color-n-900)', marginTop: 6, marginBottom: 8}}>Descartar urgencia hipertensiva</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                {['Cefalea intensa de inicio súbito', 'Alteración visual / escotomas', 'Disnea de reposo', 'Dolor torácico', 'Déficit neurológico focal'].map((q, i) => (
                  <label key={i} style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--color-n-700)'}}>
                    <span style={{display: 'flex', gap: 4}}>
                      <span style={{padding: '2px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', border: i === 0 ? '1px solid var(--color-success-text)' : '1px solid var(--color-n-200)', background: i === 0 ? 'var(--color-success-bg)' : '#fff', color: i === 0 ? 'var(--color-success-text)' : 'var(--color-n-500)', borderRadius: 3}}>No</span>
                      <span style={{padding: '2px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid var(--color-n-200)', background: '#fff', color: 'var(--color-n-500)', borderRadius: 3}}>Sí</span>
                    </span>
                    {q}
                  </label>
                ))}
              </div>
              <div style={{marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 10}}>
                <button style={{padding: '7px 14px', fontSize: 12.5, color: '#fff', background: 'var(--color-p-500)', border: 'none', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  Confirmar y continuar<i className="ph ph-arrow-right" style={{fontSize: 12}}/>
                </button>
                <span style={{fontSize: 11, color: 'var(--color-n-400)', marginLeft: 'auto'}}>Si alguna respuesta es Sí → derivación urgente</span>
              </div>
            </div>
          </div>
          <RightRail showPlan={false} stepIdx={4} decisionActive={false}/>
        </div>
      </EdgeShell>
    );
  }

  // 06 — Validation: required field missing
  if (n === 6) {
    return (
      <EdgeShell headerRight={
        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
          <span style={{fontSize: 11.5, color: 'var(--color-danger-text, #7A2B22)', display: 'flex', alignItems: 'center', gap: 6}}>
            <i className="ph ph-warning-circle" style={{fontSize: 14}}/>3 campos requeridos faltantes
          </span>
          <button disabled style={{padding: '6px 14px', fontSize: 12, color: '#fff', background: 'var(--color-n-300)', border: 'none', borderRadius: 3, fontWeight: 500, cursor: 'not-allowed'}}>
            Firmar y cerrar
          </button>
        </div>
      }>
        <Strip stepIdx={7}/>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', padding: '20px 28px', gap: 20, overflow: 'auto'}}>
          <div>
            <div style={{padding: '12px 14px', background: 'var(--color-danger-bg, #F6EAE8)', border: '1px solid var(--color-danger-border, #D9B4AE)', borderRadius: 5, fontSize: 12.5, color: 'var(--color-danger-text, #7A2B22)', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10}}>
              <i className="ph ph-warning-circle" style={{fontSize: 14, marginTop: 2}}/>
              <div style={{flex: 1}}>
                <div style={{fontWeight: 600, marginBottom: 4}}>No puedes firmar todavía</div>
                <div>Faltan 3 campos requeridos por el protocolo. Saltar al primero ↓</div>
              </div>
              <button style={{padding: '4px 10px', fontSize: 11.5, color: 'var(--color-danger-text, #7A2B22)', background: '#fff', border: '1px solid var(--color-danger-border, #D9B4AE)', borderRadius: 3}}>Ver faltantes</button>
            </div>
            <SOAPCard title="Signos vitales" accent>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px'}}>
                <SmallInput label="Presión arterial" suffix="mmHg" value="148 / 94"/>
                <SmallInput label="Frec. cardiaca" suffix="lpm" value="78"/>
                <div>
                  <div style={{fontSize: 11.5, color: 'var(--color-danger-text, #7A2B22)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4}}>Temperatura<span style={{fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '0 4px', background: 'var(--color-danger-bg)', borderRadius: 2, textTransform: 'uppercase'}}>requerido</span></div>
                  <div style={{height: 30, border: '1px solid var(--color-danger-border, #D9B4AE)', borderRadius: 3, padding: '0 9px', fontSize: 12, color: 'var(--color-n-400)', background: 'var(--color-danger-bg, #F6EAE8)', display: 'flex', alignItems: 'center'}}>—</div>
                </div>
                <SmallInput label="Saturación O₂" suffix="%" value="98"/>
                <div>
                  <div style={{fontSize: 11.5, color: 'var(--color-danger-text, #7A2B22)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4}}>Peso<span style={{fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '0 4px', background: 'var(--color-danger-bg)', borderRadius: 2, textTransform: 'uppercase'}}>requerido</span></div>
                  <div style={{height: 30, border: '1px solid var(--color-danger-border, #D9B4AE)', borderRadius: 3, padding: '0 9px', fontSize: 12, color: 'var(--color-n-400)', background: 'var(--color-danger-bg, #F6EAE8)', display: 'flex', alignItems: 'center'}}>—</div>
                </div>
                <SmallInput label="Talla" suffix="cm" value="168"/>
              </div>
            </SOAPCard>
            <SOAPCard title="Plan" accent sub={<span style={{color: 'var(--color-danger-text, #7A2B22)'}}>Requiere fecha de seguimiento</span>}>
              <FieldGhost multiline placeholder="Falta: programar próxima cita"/>
            </SOAPCard>
          </div>
          <div>
            <div style={{marginBottom: 14}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-danger-text, #7A2B22)', marginBottom: 8}}>Faltantes (3)</div>
              <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-danger-border, #D9B4AE)', borderRadius: 4}}>
                {['Temperatura', 'Peso', 'Fecha de seguimiento'].map((m, i) => (
                  <div key={m} style={{display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: 'var(--color-danger-text, #7A2B22)'}}>
                    <i className="ph ph-arrow-right" style={{fontSize: 11}}/>
                    <span style={{flex: 1}}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
            <RightRail showPlan={false} stepIdx={7} decisionActive={false}/>
          </div>
        </div>
      </EdgeShell>
    );
  }

  // 07 — Resume interrupted consultation
  if (n === 7) {
    return (
      <EdgeShell>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', background: 'var(--color-n-25)'}}>
          <div style={{width: 540, background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 6, padding: '28px 30px', boxShadow: '0 1px 0 rgba(14,14,13,0.04)'}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-p-700)', marginBottom: 6}}>Consulta en progreso</div>
            <h2 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, color: 'var(--color-n-900)', margin: '0 0 6px'}}>Bienvenido de vuelta</h2>
            <p style={{fontSize: 13, color: 'var(--color-n-500)', margin: '0 0 20px', lineHeight: 1.5}}>
              Dejaste una consulta de Isabel Cristina Cruz a medias hace 47 minutos. ¿Quieres continuar donde la dejaste?
            </p>
            <div style={{padding: '14px 16px', background: 'var(--color-n-25)', border: '1px solid var(--color-n-100)', borderRadius: 5, marginBottom: 16}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12}}>
                <div style={{width: 36, height: 36, borderRadius: '50%', background: 'var(--color-p-50)', color: 'var(--color-p-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13}}>IC</div>
                <div>
                  <div style={{fontSize: 14, color: 'var(--color-n-900)', fontWeight: 500}}>Isabel Cristina Cruz · 52 años</div>
                  <div style={{fontSize: 11.5, color: 'var(--color-n-500)'}}>Protocolo HTA — Seguimiento · paso 4 de 8</div>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10}}>
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} style={{flex: 1, height: 4, background: i <= 4 ? 'var(--color-p-500)' : 'var(--color-n-200)', borderRadius: 2}}/>
                ))}
              </div>
              <div style={{fontSize: 11.5, color: 'var(--color-n-600)', display: 'flex', justifyContent: 'space-between'}}>
                <span>Última edición: <strong style={{color: 'var(--color-n-800)'}}>Examen físico</strong></span>
                <span style={{fontFamily: 'var(--font-mono)', color: 'var(--color-n-500)'}}>09:55 a.m. · auto-guardado</span>
              </div>
            </div>
            <div style={{display: 'flex', gap: 8}}>
              <button style={{flex: 1, padding: '10px 14px', fontSize: 13, color: '#fff', background: 'var(--color-p-500)', border: 'none', borderRadius: 4, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
                <i className="ph ph-arrow-right" style={{fontSize: 13}}/>Continuar en paso 4 · Examen físico
              </button>
              <button style={{padding: '10px 14px', fontSize: 13, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>Empezar nueva</button>
            </div>
            <div style={{marginTop: 14, fontSize: 11, color: 'var(--color-n-400)', textAlign: 'center'}}>El borrador se conserva 7 días.</div>
          </div>
        </div>
      </EdgeShell>
    );
  }

  // 08 — No protocol available (clinic-level empty state)
  if (n === 8) {
    return (
      <EdgeShell>
        <div style={{flex: 1, padding: '32px 28px', overflow: 'auto', background: 'var(--color-n-25)'}}>
          <div style={{maxWidth: 760, margin: '0 auto'}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Paso 1 de 2 · ¿Qué traes hoy?</div>
            <h2 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26, color: 'var(--color-n-900)', margin: '0 0 6px'}}>Comencemos con el motivo</h2>
            <p style={{fontSize: 13.5, color: 'var(--color-n-500)', margin: 0, marginBottom: 24, maxWidth: 560}}>
              Aún no tienes protocolos configurados para tu clínica. Puedes empezar sin protocolo o instalar uno desde la biblioteca.
            </p>
            <div style={{padding: '24px 28px', background: '#fff', border: '1px dashed var(--color-n-300)', borderRadius: 6, textAlign: 'center', marginBottom: 18}}>
              <div style={{width: 56, height: 56, margin: '0 auto 12px', background: 'var(--color-n-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <i className="ph ph-list-checks" style={{fontSize: 24, color: 'var(--color-n-400)'}}/>
              </div>
              <div style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 17, color: 'var(--color-n-900)', marginBottom: 4}}>Sin protocolos configurados</div>
              <div style={{fontSize: 12.5, color: 'var(--color-n-500)', marginBottom: 16, maxWidth: 440, margin: '0 auto 16px'}}>
                Los protocolos guían tus consultas paso a paso y aceleran la documentación. Dr. García usa 2.1 protocolos por paciente en promedio.
              </div>
              <div style={{display: 'inline-flex', gap: 8}}>
                <button style={{padding: '8px 14px', fontSize: 12.5, color: '#fff', background: 'var(--color-p-500)', border: 'none', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <i className="ph ph-download-simple" style={{fontSize: 13}}/>Explorar biblioteca de protocolos
                </button>
                <button style={{padding: '8px 14px', fontSize: 12.5, color: 'var(--color-p-700)', background: 'var(--color-p-50)', border: '1px solid var(--color-p-300)', borderRadius: 4}}>Crear protocolo nuevo</button>
              </div>
            </div>
            <div style={{padding: '14px 16px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 12}}>
              <i className="ph ph-arrow-bend-up-right" style={{fontSize: 16, color: 'var(--color-n-400)'}}/>
              <div style={{flex: 1}}>
                <div style={{fontSize: 12.5, color: 'var(--color-n-700)', fontWeight: 500}}>Continuar sin protocolo</div>
                <div style={{fontSize: 11.5, color: 'var(--color-n-500)'}}>Abrir consulta SOAP en blanco. Podrás añadir protocolo más tarde.</div>
              </div>
              <button style={{padding: '7px 14px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Continuar</button>
            </div>
          </div>
        </div>
      </EdgeShell>
    );
  }

  return null;
};

window.EdgeFrame = EdgeFrame;
window.EDGE_TITLES = EDGE_TITLES;
