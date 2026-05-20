/* Flow F — start gate, then protocol-loaded consultation, click-through.
   Frames:
   1. Gate screen
   2. Gate with "HTA" highlighted/hovered
   3. Consult opens — protocol pre-loaded, motivo + vitales filled
   4. Subjetivo + examen filled
   5. Decisión active
   6. Receta generated, ready to sign
*/

const FLOW_F_TITLES = [
  '01 · Puerta de inicio',
  '02 · Selecciona motivo',
  '03 · Consulta abierta',
  '04 · Anamnesis + examen',
  '05 · Decisión clínica',
  '06 · Listo para firmar',
];

const FlowFGate = ({n}) => (
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

          <div style={{marginBottom: 24}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 10}}>Para Isabel · sus consultas anteriores</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10}}>
              {[
                {icon: 'ph-heartbeat', title: 'Seguimiento HTA', sub: 'Última: hace 3 meses · v2', primary: true, badge: 'Más probable'},
                {icon: 'ph-pulse', title: 'Control DM tipo 2', sub: 'Última: hace 6 meses · v1'},
                {icon: 'ph-stethoscope', title: 'Consulta general', sub: 'Sin protocolo guía'},
              ].map((c, i) => {
                const hovered = n === 2 && i === 0;
                return (
                  <div key={i} style={{padding: '14px 16px', background: hovered ? 'var(--color-p-50)' : '#fff', border: c.primary ? '2px solid var(--color-p-500)' : '1px solid var(--color-n-200)', borderRadius: 6, position: 'relative', transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 8px 18px -10px rgba(14,14,13,0.18)' : 'none'}}>
                    {c.badge && <span style={{position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{c.badge}</span>}
                    <i className={`ph ${c.icon}`} style={{fontSize: 20, color: c.primary ? 'var(--color-p-500)' : 'var(--color-n-500)'}}/>
                    <div style={{fontSize: 13.5, color: 'var(--color-n-900)', fontWeight: 500, marginTop: 8}}>{c.title}</div>
                    <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>{c.sub}</div>
                    {hovered && <div style={{marginTop: 8, fontSize: 11, color: 'var(--color-p-700)', display: 'flex', alignItems: 'center', gap: 4}}><i className="ph ph-arrow-right" style={{fontSize: 11}}/> Abrir consulta con este protocolo</div>}
                  </div>
                );
              })}
            </div>
          </div>

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

/* Frames 3+ — consultation already opened with protocol loaded.
   Layout uses the familiar SOAP-card column with a slim "Protocolo HTA"
   strip on top so the doctor remembers context. Notes & orders fill
   in progressively. */
const FlowFConsult = ({n}) => {
  const stepIdx = {3: 2, 4: 4, 5: 4, 6: 8}[n] || 0;
  const showSubj = n >= 4;
  const showExam = n >= 4;
  const decisionActive = n === 5;
  const showPlan = n >= 6;

  return (
    <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
      <Sidebar/>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
        <TopBar/>
        <ConsultHeader rightSlot={
          n === 6 ? (
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <span style={{fontSize: 11.5, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 6}}>
                <i className="ph ph-check-circle" style={{fontSize: 14}}/> Protocolo completo
              </span>
              <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Vista previa</button>
              <button style={{padding: '6px 14px', fontSize: 12, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6}}>
                <i className="ph ph-check" style={{fontSize: 12}}/>Firmar y cerrar
              </button>
            </div>
          ) : null
        }/>

        {/* Slim protocol context strip — reminds doctor what protocol is loaded */}
        <div style={{padding: '10px 28px', background: 'var(--color-p-50)', borderBottom: '1px solid var(--color-p-100)', display: 'flex', alignItems: 'center', gap: 12}}>
          <i className="ph ph-list-checks" style={{fontSize: 15, color: 'var(--color-p-700)'}}/>
          <div style={{fontSize: 12.5, color: 'var(--color-p-900)', fontWeight: 500}}>HTA — Seguimiento <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', marginLeft: 4}}>v2</span></div>
          <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 380}}>
            <div style={{flex: 1, height: 3, background: 'var(--color-p-100)', borderRadius: 2, overflow: 'hidden'}}>
              <div style={{width: `${(stepIdx / 8) * 100}%`, height: '100%', background: 'var(--color-p-500)'}}/>
            </div>
            <span style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-p-700)', whiteSpace: 'nowrap'}}>{stepIdx} / 8</span>
          </div>
          <button style={{fontSize: 11, color: 'var(--color-p-700)', background: 'transparent', border: '1px solid var(--color-p-100)', padding: '3px 8px', borderRadius: 3}}>Ver pasos</button>
          <button style={{fontSize: 11, color: 'var(--color-p-700)', background: 'transparent', border: 'none'}}>Cambiar</button>
        </div>

        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '20px 28px', overflow: 'auto'}}>
          <div>
            <SOAPCard title="Motivo de consulta" accent>
              <div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA. Cefaleas ocasionales, PA en casa 145/92.</div>
            </SOAPCard>
            <SOAPCard title="Signos vitales" accent sub="6 campos · pre-armado por protocolo">
              <VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/>
            </SOAPCard>

            {showSubj && (
              <SOAPCard title="Subjetivo" accent sub="Anamnesis dirigida del protocolo">
                <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>
                  Cefaleas ocasionales 2 semanas. Adherencia parcial a Losartán — olvida dosis nocturna. Sin disnea, sin dolor torácico. Niega cambios en estilo de vida.
                </div>
              </SOAPCard>
            )}

            {showExam && (
              <SOAPCard title="Examen físico" accent sub="Lista del protocolo · 4 hallazgos">
                <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>
                  Ruidos cardiacos rítmicos, sin soplos. MV conservado bilateralmente. Sin edema de MMII. Pulsos periféricos simétricos y palpables.
                </div>
              </SOAPCard>
            )}

            <SOAPCard title="Evaluación" accent={decisionActive || showPlan} sub={decisionActive ? 'Decisión activa del protocolo' : (showPlan ? 'Resuelto' : null)}>
              {decisionActive && (
                <>
                  <div style={{padding: '8px 12px', background: 'var(--color-p-50)', border: '1px solid var(--color-p-100)', borderRadius: 4, fontSize: 12, color: 'var(--color-p-900)', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8}}>
                    <i className="ph ph-arrow-right" style={{fontSize: 12, color: 'var(--color-p-500)', marginTop: 2}}/>
                    <span><strong>¿Alcanza meta PA &lt;130/80?</strong> — PA tomada: <strong>148/94</strong></span>
                  </div>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                    <div style={{padding: '10px 12px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
                      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', textTransform: 'uppercase', marginBottom: 3}}>Sí</div>
                      <div style={{fontSize: 12, color: 'var(--color-n-700)'}}>Mantener tx, control 3 meses</div>
                    </div>
                    <div style={{padding: '10px 12px', background: 'var(--color-p-50)', border: '2px solid var(--color-p-500)', borderRadius: 4, position: 'relative'}}>
                      <span style={{position: 'absolute', top: 6, right: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-p-700)', textTransform: 'uppercase'}}>Elegir</span>
                      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', textTransform: 'uppercase', marginBottom: 3}}>No · fuera de meta</div>
                      <div style={{fontSize: 12, color: 'var(--color-n-800)'}}>Agregar Amlodipino 5mg, control 4 sem</div>
                    </div>
                  </div>
                  {/* Advance affordance — same pattern as Flow E */}
                  <div style={{marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 10}}>
                    <button style={{padding: '7px 14px', fontSize: 12.5, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6}}>
                      Aplicar rama y continuar
                      <i className="ph ph-arrow-right" style={{fontSize: 12}}/>
                    </button>
                    <button style={{padding: '7px 12px', fontSize: 12, color: 'var(--color-n-600)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>Saltar paso</button>
                    <span style={{fontSize: 11, color: 'var(--color-n-400)', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto'}}>
                      <i className="ph ph-arrow-down" style={{fontSize: 11}}/>
                      Siguiente: <span style={{color: 'var(--color-n-700)', fontWeight: 500}}>Tratamiento + receta</span>
                    </span>
                  </div>
                </>
              )}
              {showPlan && (
                <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55}}>
                  HTA estadio 1 fuera de meta. Adherencia subóptima. Se intensifica con Amlodipino 5mg.
                </div>
              )}
              {!decisionActive && !showPlan && <FieldGhost multiline placeholder="Esperando paso 5 del protocolo…"/>}
            </SOAPCard>

            <SOAPCard title="Plan" accent={showPlan}>
              {showPlan ? (
                <>
                  <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.55, marginBottom: 10}}>
                    Continuar Losartán 50mg c/24h. Iniciar Amlodipino 5mg c/24h. Educación adherencia y dieta DASH. Control en 4 semanas.
                  </div>
                  <div style={{padding: '8px 10px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 4, fontSize: 12, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 6}}>
                    <i className="ph ph-check-circle" style={{fontSize: 13}}/>Receta generada · 2 fármacos · seguimiento agendado 30 may
                  </div>
                </>
              ) : (
                <FieldGhost multiline height={50} placeholder="Se llenará al completar la decisión…"/>
              )}
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
            <div style={{marginBottom: 14}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Pasos del protocolo</div>
              <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
                {[
                  {n: 1, label: 'Motivo'},
                  {n: 2, label: 'Vitales'},
                  {n: 3, label: 'Subjetivo'},
                  {n: 4, label: 'Examen'},
                  {n: 5, label: 'Decisión'},
                  {n: 6, label: 'Tratamiento'},
                  {n: 7, label: 'Educación'},
                  {n: 8, label: 'Cierre'},
                ].map(s => {
                  const done = s.n <= stepIdx;
                  const active = decisionActive && s.n === 5;
                  return (
                    <div key={s.n} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12}}>
                      <span style={{display: 'flex', alignItems: 'center', gap: 8, color: done ? 'var(--color-n-700)' : 'var(--color-n-400)', fontWeight: active ? 500 : 400}}>
                        <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)', minWidth: 14}}>{String(s.n).padStart(2, '0')}</span>
                        {s.label}
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
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}>
                  <span>Receta</span>
                  <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: showPlan ? 'var(--color-success-text)' : 'var(--color-n-500)'}}>
                    {showPlan ? '✓ 2 fármacos' : '0'}
                  </span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Laboratorio</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Imagen</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FlowFFrame = ({n}) => (n <= 2 ? <FlowFGate n={n}/> : <FlowFConsult n={n}/>);

window.FlowFFrame = FlowFFrame;
window.FLOW_F_TITLES = FLOW_F_TITLES;
