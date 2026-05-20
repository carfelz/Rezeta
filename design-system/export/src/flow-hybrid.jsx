/* Hybrid flow:
   - Frames 1-2: Start gate (F)
   - Frame 3: Consult opens in DEFAULT (SOAP) mode w/ protocol strip
   - Frame 4: Doctor flips a "Vista Protocolo" toggle in the strip → switches to CANVAS (E) mode
   - Frame 5: Decision step in canvas mode with advance button
   - Frame 6: Back in SOAP mode at the end (toggle is per-doctor preference)
*/
const HYBRID_TITLES = [
  '01 · Puerta de inicio',
  '02 · HTA seleccionado',
  '03 · Consulta · vista SOAP (default)',
  '04 · Cambio a vista Protocolo',
  '05 · Decisión clínica · vista Protocolo',
  '06 · Vista SOAP · listo para firmar',
];

const ModeToggle = ({mode}) => (
  <div style={{display: 'inline-flex', background: 'var(--color-p-100)', border: '1px solid var(--color-p-100)', borderRadius: 4, padding: 2, gap: 2}}>
    {['SOAP', 'Protocolo'].map(m => {
      const active = (mode === 'soap' && m === 'SOAP') || (mode === 'canvas' && m === 'Protocolo');
      return (
        <span key={m} style={{padding: '3px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: 3, background: active ? '#fff' : 'transparent', color: active ? 'var(--color-p-700)' : 'var(--color-p-700)', opacity: active ? 1 : 0.6, fontWeight: active ? 600 : 400}}>{m}</span>
      );
    })}
  </div>
);

const ProtocolStrip = ({stepIdx, mode, hint}) => (
  <div style={{padding: '10px 28px', background: 'var(--color-p-50)', borderBottom: '1px solid var(--color-p-100)', display: 'flex', alignItems: 'center', gap: 12}}>
    <i className="ph ph-list-checks" style={{fontSize: 15, color: 'var(--color-p-700)'}}/>
    <div style={{fontSize: 12.5, color: 'var(--color-p-900)', fontWeight: 500}}>HTA — Seguimiento <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', marginLeft: 4}}>v2</span></div>
    <div style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 220}}>
      <div style={{flex: 1, height: 3, background: 'var(--color-p-100)', borderRadius: 2, overflow: 'hidden'}}>
        <div style={{width: `${(stepIdx / 8) * 100}%`, height: '100%', background: 'var(--color-p-500)'}}/>
      </div>
      <span style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-p-700)', whiteSpace: 'nowrap'}}>{stepIdx} / 8</span>
    </div>
    {hint && <span style={{fontSize: 11, color: 'var(--color-p-700)', fontStyle: 'italic'}}>{hint}</span>}
    <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
      <span style={{fontSize: 10.5, color: 'var(--color-p-700)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>Vista</span>
      <ModeToggle mode={mode}/>
    </div>
  </div>
);

const HybridFrame = ({n}) => {
  // Reuse Flow F's gate for n=1,2; then SOAP layout for 3,6 and Canvas for 4,5
  if (n <= 2) return <FlowFGate n={n}/>;

  const mode = (n === 4 || n === 5) ? 'canvas' : 'soap';
  const stepIdx = {3: 4, 4: 4, 5: 4, 6: 8}[n];
  const showPlan = n === 6;
  const decisionActive = n === 5;

  return (
    <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
      <Sidebar/>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
        <TopBar/>
        <ConsultHeader rightSlot={
          n === 6 ? (
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <span style={{fontSize: 11.5, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 6}}>
                <i className="ph ph-check-circle" style={{fontSize: 14}}/>Protocolo completo
              </span>
              <button style={{padding: '6px 14px', fontSize: 12, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6}}>
                <i className="ph ph-check" style={{fontSize: 12}}/>Firmar y cerrar
              </button>
            </div>
          ) : null
        }/>

        <ProtocolStrip stepIdx={stepIdx} mode={mode} hint={n === 4 ? 'Cambiando a vista guiada paso a paso…' : null}/>

        {/* SOAP MODE — frames 3 & 6 */}
        {mode === 'soap' && (
          <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '20px 28px', overflow: 'auto'}}>
            <div>
              <SOAPCard title="Motivo" accent>
                <div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA. Cefaleas ocasionales, PA en casa 145/92.</div>
              </SOAPCard>
              <SOAPCard title="Signos vitales" accent>
                <VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/>
              </SOAPCard>
              <SOAPCard title="Subjetivo" accent>
                <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>Cefaleas ocasionales 2 sem. Adherencia parcial — olvida dosis nocturna.</div>
              </SOAPCard>
              <SOAPCard title="Examen físico" accent>
                <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>RsCs rítmicos sin soplos. MV conservado. Sin edema MMII. Pulsos simétricos.</div>
              </SOAPCard>
              <SOAPCard title="Evaluación" accent={showPlan} sub={!showPlan ? 'Esperando paso 5 del protocolo' : null}>
                {showPlan ? <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>HTA estadio 1 fuera de meta. Adherencia subóptima. Se intensifica con Amlodipino 5mg.</div> : <FieldGhost multiline placeholder="Pendiente"/>}
              </SOAPCard>
              <SOAPCard title="Plan" accent={showPlan}>
                {showPlan ? (
                  <>
                    <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55, marginBottom: 10}}>Continuar Losartán 50mg + iniciar Amlodipino 5mg. Educación adherencia + DASH. Control 4 sem.</div>
                    <div style={{padding: '8px 10px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 4, fontSize: 12, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 6}}>
                      <i className="ph ph-check-circle" style={{fontSize: 13}}/>Receta · 2 fármacos · seguimiento 30 may
                    </div>
                  </>
                ) : <FieldGhost multiline placeholder="Pendiente"/>}
              </SOAPCard>
              {n === 3 && (
                <div style={{marginTop: 4, padding: '12px 14px', background: '#fff', border: '1px dashed var(--color-p-300)', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 12}}>
                  <i className="ph ph-list-checks" style={{fontSize: 18, color: 'var(--color-p-500)'}}/>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 12.5, color: 'var(--color-n-900)', fontWeight: 500}}>Protocolo activo · paso 5 de 8 esperando</div>
                    <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>El protocolo HTA tiene una decisión pendiente. ¿Quieres trabajar con vista guiada?</div>
                  </div>
                  <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-p-700)', background: 'var(--color-p-50)', border: '1px solid var(--color-p-300)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6}}>
                    <i className="ph ph-arrow-right" style={{fontSize: 12}}/>Cambiar a vista Protocolo
                  </button>
                </div>
              )}
            </div>
            <RightRail showPlan={showPlan} stepIdx={stepIdx} decisionActive={decisionActive}/>
          </div>
        )}

        {/* CANVAS MODE — frames 4 & 5 */}
        {mode === 'canvas' && (
          <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0, overflow: 'hidden'}}>
            <div style={{padding: '20px 28px', overflow: 'auto'}}>
              <ProtoStep n="01" title="Motivo de consulta" status="done"><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA. Cefaleas, PA casa 145/92.</div></ProtoStep>
              <ProtoStep n="02" title="Signos vitales" status="done"><VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/></ProtoStep>
              <ProtoStep n="03" title="Subjetivo" status="done"><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Cefaleas 2 sem. Adherencia parcial.</div></ProtoStep>
              <ProtoStep n="04" title="Examen físico" status="done"><div style={{fontSize: 13, color: 'var(--color-n-700)'}}>RsCs rítmicos. MV conservado. Sin edema. Pulsos simétricos.</div></ProtoStep>
              <ProtoStep n="05" title="Decisión clínica" status="active" sub="Algoritmo · ¿Alcanza meta PA <130/80?" nextLabel="Tratamiento" completeLabel="Aplicar rama y continuar">
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                  <div style={{padding: '12px 14px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5}}>
                    <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', textTransform: 'uppercase', marginBottom: 4}}>Sí</div>
                    <div style={{fontSize: 12.5, color: 'var(--color-n-700)'}}>Mantener tratamiento, control en 3 meses.</div>
                  </div>
                  <div style={{padding: '12px 14px', background: 'var(--color-p-50)', border: '2px solid var(--color-p-500)', borderRadius: 5, position: 'relative'}}>
                    <span style={{position: 'absolute', top: 8, right: 8, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', textTransform: 'uppercase'}}>Seleccionado</span>
                    <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', textTransform: 'uppercase', marginBottom: 4}}>No · fuera de meta</div>
                    <div style={{fontSize: 12.5, color: 'var(--color-n-800)'}}>Agregar Amlodipino 5mg, control 4 sem.</div>
                  </div>
                </div>
              </ProtoStep>
              <ProtoStep n="06" title="Tratamiento" status="next" sub="Tabla de dosificación"><div style={{fontSize: 12.5, color: 'var(--color-n-500)'}}>Se llenará al confirmar la decisión…</div></ProtoStep>
            </div>
            <RightRail showPlan={false} stepIdx={4} decisionActive={true}/>
          </div>
        )}
      </div>
    </div>
  );
};

const RightRail = ({showPlan, stepIdx, decisionActive}) => (
  <div style={{padding: '20px 24px 20px 12px', borderLeft: '1px solid var(--color-n-100)', overflow: 'auto'}}>
    <div style={{marginBottom: 16}}>
      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
        <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
        <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
      </div>
    </div>
    <div style={{marginBottom: 16}}>
      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Pasos del protocolo</div>
      <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
        {['Motivo','Vitales','Subjetivo','Examen','Decisión','Tratamiento','Educación','Cierre'].map((s, i) => {
          const done = (i + 1) <= stepIdx;
          const active = decisionActive && (i + 1) === 5;
          return (
            <div key={s} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12}}>
              <span style={{display: 'flex', alignItems: 'center', gap: 8, color: done ? 'var(--color-n-700)' : 'var(--color-n-400)', fontWeight: active ? 500 : 400}}>
                <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)', minWidth: 14}}>{String(i+1).padStart(2,'0')}</span>{s}
              </span>
              {done && <i className="ph ph-check-circle" style={{fontSize: 13, color: 'var(--color-success-text)'}}/>}
              {active && <span style={{fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', textTransform: 'uppercase'}}>en curso</span>}
            </div>
          );
        })}
      </div>
    </div>
    <div>
      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Órdenes</div>
      <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4, fontSize: 12, color: 'var(--color-n-700)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Receta</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: showPlan ? 'var(--color-success-text)' : 'var(--color-n-500)'}}>{showPlan ? '✓ 2 fármacos' : '0'}</span></div>
        <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Laboratorio</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
      </div>
    </div>
  </div>
);

window.HybridFrame = HybridFrame;
window.HYBRID_TITLES = HYBRID_TITLES;
