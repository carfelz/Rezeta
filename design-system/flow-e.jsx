/* Flow E — protocol-first canvas, click-through.
   Each <Frame n=...> renders a different state of the same screen. */

const FLOW_E_TITLES = [
  '01 · Consulta vacía',
  '02 · Elegir protocolo',
  '03 · Motivo + vitales',
  '04 · Examen físico',
  '05 · Decisión clínica',
  '06 · Tratamiento + receta',
  '07 · Listo para firmar',
];

const FlowEFrame = ({n}) => {
  // Steps shown progressively, decided per frame
  const stepStatus = (idx) => {
    // idx 1..8
    if (n <= 1) return 'hidden';
    if (n === 2) return 'hidden'; // picker overlay
    const completed = {3: 2, 4: 4, 5: 4, 6: 5, 7: 8}[n] || 0;
    const active = {3: 3, 4: 5, 5: 5, 6: 6, 7: null}[n];
    if (idx <= completed) return 'done';
    if (idx === active) return 'active';
    return 'next';
  };

  const progressFraction = {1: 0, 2: 0, 3: 2/8, 4: 4/8, 5: 4/8, 6: 6/8, 7: 8/8}[n];

  return (
    <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)', position: 'relative'}}>
      <Sidebar/>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
        <TopBar/>
        <ConsultHeader rightSlot={
          n === 7 ? (
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

        {/* Progress strip — appears once protocol loaded */}
        {n >= 3 && (
          <div style={{padding: '12px 28px', background: '#fff', borderBottom: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 14}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <div style={{width: 26, height: 26, background: 'var(--color-p-500)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <i className="ph ph-list-checks" style={{fontSize: 14, color: '#fff'}}/>
              </div>
              <div>
                <div style={{fontSize: 13, color: 'var(--color-n-900)', fontWeight: 500, lineHeight: 1.2}}>
                  HTA — Seguimiento <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 5px', borderRadius: 3, marginLeft: 4}}>v2</span>
                </div>
                <div style={{fontSize: 11, color: 'var(--color-n-500)', lineHeight: 1.2}}>
                  Protocolo activo · {Math.round(progressFraction * 8)} de 8 pasos
                </div>
              </div>
            </div>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12}}>
              {['Motivo', 'Vitales', 'Subjetivo', 'Examen', 'Decisión', 'Tratamiento', 'Receta', 'Cierre'].map((s, i) => {
                const done = (i + 1) <= Math.round(progressFraction * 8);
                return (
                  <div key={i} style={{flex: 1, display: 'flex', alignItems: 'center', gap: 4}}>
                    <div style={{flex: 1, height: 3, background: done ? 'var(--color-p-500)' : 'var(--color-n-200)', borderRadius: 2}}/>
                    <span style={{fontSize: 10.5, color: done ? 'var(--color-p-700)' : 'var(--color-n-400)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'}}>{i + 1}. {s}</span>
                  </div>
                );
              })}
            </div>
            <button style={{fontSize: 11.5, color: 'var(--color-n-600)', padding: '5px 10px', border: '1px solid var(--color-n-200)', borderRadius: 3, background: '#fff'}}>Cambiar protocolo</button>
          </div>
        )}

        {/* Body */}
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: n >= 3 ? '1fr 280px' : '1fr', gap: 0, overflow: 'hidden'}}>
          <div style={{padding: '20px 28px', overflow: 'auto'}}>
            {/* FRAME 1 — empty start */}
            {n === 1 && (
              <div style={{maxWidth: 560, margin: '40px auto 0', textAlign: 'center'}}>
                <div style={{width: 56, height: 56, margin: '0 auto 14px', background: 'var(--color-p-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <i className="ph ph-list-checks" style={{fontSize: 28, color: 'var(--color-p-500)'}}/>
                </div>
                <h2 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, color: 'var(--color-n-900)', margin: '0 0 6px'}}>Empieza con un protocolo</h2>
                <p style={{fontSize: 13.5, color: 'var(--color-n-500)', margin: '0 0 18px', lineHeight: 1.5}}>
                  Esta consulta se construirá guiada por un protocolo. Las notas SOAP, recetas y órdenes se llenarán a medida que avances.
                </p>
                <div style={{display: 'inline-flex', gap: 8}}>
                  <button style={{padding: '8px 16px', fontSize: 13, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <i className="ph ph-plus" style={{fontSize: 12}}/>Elegir protocolo
                  </button>
                  <button style={{padding: '8px 14px', fontSize: 13, color: 'var(--color-n-600)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>Continuar sin protocolo</button>
                </div>
                <div style={{marginTop: 28, padding: '14px 16px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, textAlign: 'left'}}>
                  <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Sugerencias para Isabel</div>
                  {[
                    {title: 'HTA — Seguimiento', sub: 'Última consulta: hace 3 meses · usado 47 veces', match: 96, primary: true},
                    {title: 'Control trimestral', sub: 'Por edad y comorbilidades', match: 78},
                  ].map((p, i) => (
                    <div key={i} style={{padding: '8px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12, background: p.primary ? 'var(--color-p-50)' : 'transparent', marginBottom: 4}}>
                      <i className="ph ph-list-checks" style={{fontSize: 16, color: p.primary ? 'var(--color-p-500)' : 'var(--color-n-500)'}}/>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: 13, color: 'var(--color-n-900)', fontWeight: 500}}>{p.title}</div>
                        <div style={{fontSize: 11.5, color: 'var(--color-n-500)'}}>{p.sub}</div>
                      </div>
                      <span style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-p-700)'}}>{p.match}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FRAMES 3+ — show progressive steps */}
            {n >= 3 && (
              <>
                {/* 01 */}
                <ProtoStep n="01" title="Motivo de consulta" status={stepStatus(1)} nextLabel="Signos vitales">
                  <div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA. Cefaleas ocasionales, PA en casa 145/92.</div>
                </ProtoStep>

                {/* 02 */}
                <ProtoStep n="02" title="Signos vitales" status={stepStatus(2)} sub="6 campos requeridos por protocolo" nextLabel="Subjetivo · anamnesis dirigida">
                  <VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/>
                </ProtoStep>

                {/* 03 */}
                {n >= 4 && (
                  <ProtoStep n="03" title="Subjetivo" status={stepStatus(3)} sub="Anamnesis dirigida del protocolo" nextLabel="Examen físico">
                    <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.5}}>
                      Cefaleas ocasionales 2 semanas. Adherencia parcial — olvida dosis nocturna. Sin disnea, sin dolor torácico. Niega cambios en estilo de vida.
                    </div>
                  </ProtoStep>
                )}

                {/* 04 */}
                {n >= 4 && (
                  <ProtoStep n="04" title="Examen físico" status={stepStatus(4)} sub="Lista del protocolo · 4 hallazgos" nextLabel="Decisión clínica" completeLabel="Confirmar hallazgos y continuar">
                    {[
                      ['Auscultación cardiaca', 'Ruidos rítmicos, sin soplos'],
                      ['Auscultación pulmonar', 'MV conservado'],
                      ['Edema de MMII', 'Ausente'],
                      ['Pulsos periféricos', 'Simétricos, palpables'],
                    ].map(([k, v], i) => (
                      <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 3 ? '1px solid var(--color-n-100)' : 'none'}}>
                        <div style={{width: 16, height: 16, borderRadius: 3, background: 'var(--color-p-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                          <i className="ph ph-check" style={{fontSize: 11, color: '#fff'}}/>
                        </div>
                        <div style={{flex: 1, fontSize: 12.5, color: 'var(--color-n-700)'}}>{k}</div>
                        <div style={{fontSize: 12, color: 'var(--color-n-500)'}}>{v}</div>
                      </div>
                    ))}
                  </ProtoStep>
                )}

                {/* 05 */}
                {n >= 5 && (
                  <ProtoStep n="05" title="Decisión clínica" status={stepStatus(5)} sub="Algoritmo · ¿Alcanza meta de PA <130/80?" nextLabel="Tratamiento" completeLabel="Aplicar rama seleccionada">
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                      <div style={{padding: '12px 14px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, opacity: n >= 6 ? 0.5 : 1}}>
                        <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4}}>Sí · en meta</div>
                        <div style={{fontSize: 12.5, color: 'var(--color-n-700)', lineHeight: 1.4}}>Mantener tratamiento, control en 3 meses.</div>
                      </div>
                      <div style={{padding: '12px 14px', background: 'var(--color-p-50)', border: '2px solid var(--color-p-500)', borderRadius: 5, position: 'relative'}}>
                        {n >= 6 && <span style={{position: 'absolute', top: 8, right: 8, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', textTransform: 'uppercase'}}>Seleccionado</span>}
                        <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4}}>No · fuera de meta</div>
                        <div style={{fontSize: 12.5, color: 'var(--color-n-800)', lineHeight: 1.4}}>Agregar BCC (Amlodipino 5mg) · evaluar adherencia · control en 4 semanas.</div>
                      </div>
                    </div>
                  </ProtoStep>
                )}

                {/* 06 */}
                {n >= 6 && (
                  <ProtoStep n="06" title="Tratamiento" status={stepStatus(6)} sub="Tabla de dosificación del protocolo" nextLabel="Educación al paciente" completeLabel="Generar receta y continuar">
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
                      <thead>
                        <tr style={{borderBottom: '1px solid var(--color-n-200)'}}>
                          {['Fármaco', 'Dosis', 'Vía', 'Frecuencia', 'Duración'].map(h => (
                            <th key={h} style={{textAlign: 'left', padding: '6px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--color-n-500)', textTransform: 'uppercase', fontWeight: 400, letterSpacing: '0.06em'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Losartán', '50 mg', 'VO', 'c/24h noche', 'Continuo'],
                          ['Amlodipino', '5 mg', 'VO', 'c/24h mañana', 'Continuo'],
                        ].map((r, i) => (
                          <tr key={i} style={{borderBottom: '1px solid var(--color-n-100)'}}>
                            {r.map((c, j) => (
                              <td key={j} style={{padding: '8px', color: j === 0 ? 'var(--color-n-900)' : 'var(--color-n-600)', fontWeight: j === 0 ? 500 : 400}}>{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {n === 6 && (
                      <div style={{display: 'flex', gap: 6, marginTop: 10}}>
                        <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-n-600)', border: '1px dashed var(--color-n-200)', background: 'transparent', borderRadius: 3}}>+ Añadir medicamento</button>
                        <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-p-700)', border: '1px solid var(--color-p-300)', background: 'var(--color-p-50)', borderRadius: 3}}>Generar receta</button>
                      </div>
                    )}
                    {n === 7 && (
                      <div style={{marginTop: 10, padding: '8px 10px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 4, fontSize: 12, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 6}}>
                        <i className="ph ph-check-circle" style={{fontSize: 13}}/>Receta generada · 2 fármacos
                      </div>
                    )}
                  </ProtoStep>
                )}

                {/* 07 educación */}
                {n >= 7 && (
                  <ProtoStep n="07" title="Educación al paciente" status="done" sub="Checklist del protocolo">
                    {['Explicar meta de PA <130/80', 'Reforzar adherencia (alarma nocturna)', 'Dieta DASH · reducir sodio', 'Cuándo consultar de urgencia'].map((it, i) => (
                      <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0'}}>
                        <i className="ph ph-check" style={{fontSize: 12, color: 'var(--color-p-500)'}}/>
                        <span style={{fontSize: 12.5, color: 'var(--color-n-700)'}}>{it}</span>
                      </div>
                    ))}
                  </ProtoStep>
                )}

                {/* 08 cierre */}
                {n >= 7 && (
                  <ProtoStep n="08" title="Programar seguimiento" status="done">
                    <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-n-700)'}}>
                      <i className="ph ph-calendar-blank" style={{fontSize: 14, color: 'var(--color-p-500)'}}/>
                      Próxima consulta: <strong>30 de mayo de 2026</strong>
                      <span style={{color: 'var(--color-n-500)', fontSize: 12}}>· en 4 semanas</span>
                    </div>
                  </ProtoStep>
                )}
              </>
            )}
          </div>

          {/* Right rail — only when protocol is loaded */}
          {n >= 3 && (
            <div style={{padding: '20px 24px 20px 12px', borderLeft: '1px solid var(--color-n-100)', overflow: 'auto'}}>
              <div style={{marginBottom: 18}}>
                <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                  <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
                  <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
                </div>
              </div>
              <div style={{marginBottom: 18}}>
                <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Resultado SOAP</div>
                <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
                  {[
                    {k: 'Subjetivo', done: n >= 4},
                    {k: 'Objetivo', done: n >= 4},
                    {k: 'Evaluación', done: n >= 6},
                    {k: 'Plan', done: n >= 7},
                  ].map(({k, done}) => (
                    <div key={k} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0'}}>
                      <span style={{fontSize: 12, color: done ? 'var(--color-n-700)' : 'var(--color-n-400)'}}>{k}</span>
                      {done
                        ? <i className="ph ph-check-circle" style={{fontSize: 13, color: 'var(--color-success-text)'}}/>
                        : <i className="ph ph-circle" style={{fontSize: 13, color: 'var(--color-n-300)'}}/>
                      }
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Órdenes</div>
                <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4, fontSize: 12, color: 'var(--color-n-700)'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}>
                    <span>Receta</span>
                    <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: n >= 7 ? 'var(--color-success-text)' : 'var(--color-n-500)'}}>
                      {n >= 7 ? '✓ 2 fármacos' : (n >= 6 ? '2 fármacos' : '0')}
                    </span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Laboratorio</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Imagen</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FRAME 2 — protocol picker overlay */}
      {n === 2 && (
        <div style={{position: 'absolute', inset: 0, background: 'rgba(14,14,13,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20}}>
          <div style={{width: 620, maxHeight: '78%', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 8, boxShadow: '0 1px 0 rgba(14,14,13,0.04), 0 24px 48px -16px rgba(14,14,13,0.30), 0 4px 12px rgba(14,14,13,0.10)', display: 'flex', flexDirection: 'column'}}>
            <div style={{padding: '16px 20px 12px', borderBottom: '1px solid var(--color-n-100)'}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 4}}>Elige un protocolo</div>
              <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 20, color: 'var(--color-n-900)', margin: 0}}>Comenzar consulta de Isabel</h3>
              <div style={{position: 'relative', marginTop: 12}}>
                <i className="ph ph-magnifying-glass" style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-n-400)'}}/>
                <div style={{height: 34, paddingLeft: 32, paddingRight: 8, border: '1px solid var(--color-n-200)', borderRadius: 4, fontSize: 12.5, color: 'var(--color-n-400)', display: 'flex', alignItems: 'center', background: '#fff'}}>Buscar entre 34 protocolos…</div>
              </div>
            </div>
            <div style={{padding: '8px 8px 14px', overflow: 'auto'}}>
              <div style={{padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>Para Isabel</div>
              {[
                {title: 'HTA — Seguimiento', sub: 'Última: hace 3 meses · 8 pasos · usado 47 veces', match: 96, primary: true},
                {title: 'Control DM tipo 2', sub: 'Comorbilidad detectada · 6 pasos', match: 71},
                {title: 'Evaluación cardiovascular integral', sub: 'Por edad + HTA · 12 pasos', match: 63},
              ].map((p, i) => (
                <div key={i} style={{margin: '0 8px 4px', padding: '10px 12px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 12, background: p.primary ? 'var(--color-p-50)' : 'transparent', borderLeft: p.primary ? '2px solid var(--color-p-500)' : '2px solid transparent'}}>
                  <i className="ph ph-list-checks" style={{fontSize: 16, color: p.primary ? 'var(--color-p-700)' : 'var(--color-n-500)'}}/>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 13.5, color: 'var(--color-n-900)', fontWeight: 500}}>{p.title}</div>
                    <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>{p.sub}</div>
                  </div>
                  <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-p-700)'}}>{p.match}%</span>
                  {p.primary && <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', background: '#fff', border: '1px solid var(--color-n-200)', padding: '1px 5px', borderRadius: 3}}>↵</kbd>}
                </div>
              ))}
              <div style={{padding: '6px 12px', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>Recientes</div>
              {[
                {title: 'Control de embarazo', sub: '2do trimestre · 7 pasos'},
                {title: 'Cefalea — diagnóstico diferencial', sub: 'Decisión · 5 pasos'},
              ].map((p, i) => (
                <div key={i} style={{margin: '0 8px 4px', padding: '10px 12px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 12}}>
                  <i className="ph ph-list-checks" style={{fontSize: 16, color: 'var(--color-n-500)'}}/>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 13.5, color: 'var(--color-n-900)', fontWeight: 500}}>{p.title}</div>
                    <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>{p.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding: '10px 20px', borderTop: '1px solid var(--color-n-100)', background: 'var(--color-n-25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-n-500)'}}>
              <span><kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', border: '1px solid var(--color-n-200)', borderRadius: 2, background: '#fff'}}>↑↓</kbd> navegar · <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', border: '1px solid var(--color-n-200)', borderRadius: 2, background: '#fff'}}>↵</kbd> elegir</span>
              <button style={{fontSize: 12, color: 'var(--color-n-600)', background: 'transparent', border: 'none'}}>Continuar sin protocolo →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProtoStep = ({n, title, status, sub, children, nextLabel, completeLabel}) => {
  const styles = {
    done:   {ring: 'var(--color-p-500)', text: 'var(--color-p-700)', bg: 'var(--color-p-500)', icon: 'ph-check', iconColor: '#fff'},
    active: {ring: 'var(--color-p-500)', text: 'var(--color-p-700)', bg: 'var(--color-p-50)', icon: '', iconColor: 'var(--color-p-700)'},
    next:   {ring: 'var(--color-n-200)', text: 'var(--color-n-500)', bg: '#fff', icon: '', iconColor: 'var(--color-n-500)'},
  }[status] || {ring: 'var(--color-n-200)', text: 'var(--color-n-500)', bg: '#fff', icon: '', iconColor: 'var(--color-n-500)'};

  // The active step gets a visible advance affordance: a primary "Marcar completo
  // y continuar" button + keyboard hint. Done steps show a discreet "Editar"
  // hover affordance via an inline link. Next steps stay inert.
  const isActive = status === 'active';
  const isDone = status === 'done';

  return (
    <div style={{display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14, marginBottom: 18, opacity: status === 'next' ? 0.55 : 1}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{width: 28, height: 28, borderRadius: '50%', background: styles.bg, border: `1.5px solid ${styles.ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: styles.iconColor, fontWeight: 600}}>
          {styles.icon ? <i className={`ph ${styles.icon}`} style={{fontSize: 13}}/> : n}
        </div>
        <div style={{flex: 1, width: 1, background: 'var(--color-n-200)', marginTop: 4}}/>
      </div>
      <div style={{paddingBottom: 6}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: sub ? 2 : 8}}>
          <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 17, color: 'var(--color-n-900)', margin: 0}}>{title}</h3>
          {isActive && <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: 'var(--color-p-50)', border: '1px solid var(--color-p-100)', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em'}}>En curso</span>}
          <div style={{flex: 1}}/>
          {isDone && (
            <button style={{fontSize: 11.5, color: 'var(--color-n-500)', background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 4}}>
              <i className="ph ph-pencil-simple" style={{fontSize: 11}}/>Editar
            </button>
          )}
        </div>
        {sub && <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginBottom: 10}}>{sub}</div>}
        <div style={{background: '#fff', border: isActive ? '1px solid var(--color-p-300)' : '1px solid var(--color-n-200)', boxShadow: isActive ? '0 0 0 3px var(--color-p-50)' : 'none', borderRadius: 5, padding: '12px 14px'}}>
          {children}

          {/* Active-step footer: primary advance button + keyboard hint */}
          {isActive && (
            <div style={{marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 10}}>
              <button style={{padding: '7px 14px', fontSize: 12.5, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6}}>
                {completeLabel || 'Marcar completo y continuar'}
                <i className="ph ph-arrow-right" style={{fontSize: 12}}/>
              </button>
              <button style={{padding: '7px 12px', fontSize: 12, color: 'var(--color-n-600)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>Saltar paso</button>
              <span style={{fontSize: 11, color: 'var(--color-n-400)', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto'}}>
                <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', border: '1px solid var(--color-n-200)', borderRadius: 2, background: 'var(--color-n-25)'}}>⌘</kbd>
                <kbd style={{fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', border: '1px solid var(--color-n-200)', borderRadius: 2, background: 'var(--color-n-25)'}}>↵</kbd>
                avanzar
              </span>
            </div>
          )}
        </div>

        {/* "Next: <step name>" preview under active step — sets expectation */}
        {isActive && nextLabel && (
          <div style={{marginTop: 8, fontSize: 11.5, color: 'var(--color-n-500)', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4}}>
            <i className="ph ph-arrow-down" style={{fontSize: 11}}/>
            Siguiente: <span style={{color: 'var(--color-n-700)', fontWeight: 500}}>{nextLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

window.FlowEFrame = FlowEFrame;
window.FLOW_E_TITLES = FLOW_E_TITLES;
