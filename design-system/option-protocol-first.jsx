/* === OPTION C — PROTOCOL-FIRST CANVAS =====================================
   The protocol IS the consultation. Steps from the protocol are the primary
   spine; SOAP fields are auto-derived. Doctor walks down a single column,
   ticking, typing into prompts. */
const OptionProtocolFirst = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader/>

      {/* Top progress strip — clear, glanceable */}
      <div style={{padding: '12px 28px', background: '#fff', borderBottom: '1px solid var(--color-n-100)', display: 'flex', alignItems: 'center', gap: 14}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{width: 26, height: 26, background: 'var(--color-p-500)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <i className="ph ph-list-checks" style={{fontSize: 14, color: '#fff'}}/>
          </div>
          <div>
            <div style={{fontSize: 13, color: 'var(--color-n-900)', fontWeight: 500, lineHeight: 1.2}}>HTA — Seguimiento <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: 'var(--color-p-50)', padding: '1px 5px', borderRadius: 3, marginLeft: 4}}>v2</span></div>
            <div style={{fontSize: 11, color: 'var(--color-n-500)', lineHeight: 1.2}}>Protocolo activo · 5 de 8 pasos</div>
          </div>
        </div>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12}}>
          {['Motivo', 'Vitales', 'Subjetivo', 'Examen', 'Decisión', 'Tratamiento', 'Receta', 'Cierre'].map((s, i) => (
            <div key={i} style={{flex: 1, display: 'flex', alignItems: 'center', gap: 4}}>
              <div style={{flex: 1, height: 3, background: i < 5 ? 'var(--color-p-500)' : 'var(--color-n-200)', borderRadius: 2}}/>
              <span style={{fontSize: 10.5, color: i < 5 ? 'var(--color-p-700)' : 'var(--color-n-400)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'}}>{i + 1}. {s}</span>
            </div>
          ))}
        </div>
        <button style={{fontSize: 11.5, color: 'var(--color-n-600)', padding: '5px 10px', border: '1px solid var(--color-n-200)', borderRadius: 3, background: '#fff'}}>Cambiar protocolo</button>
      </div>

      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 0, overflow: 'auto'}}>
        <div style={{padding: '20px 28px'}}>
          {/* Step 1 — done */}
          <ProtoStep n="01" title="Motivo de consulta" status="done">
            <div style={{fontSize: 13, color: 'var(--color-n-700)'}}>Seguimiento HTA. Cefaleas ocasionales, PA en casa 145/92.</div>
          </ProtoStep>

          {/* Step 2 — done */}
          <ProtoStep n="02" title="Signos vitales" status="done" sub="6 campos requeridos por protocolo">
            <VitalsGrid values={{pa: '148 / 94', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/>
          </ProtoStep>

          {/* Step 3 — done */}
          <ProtoStep n="03" title="Subjetivo" status="done">
            <div style={{fontSize: 13, color: 'var(--color-n-700)', lineHeight: 1.5}}>Cefaleas ocasionales 2 semanas. Adherencia parcial — olvida dosis nocturna. Sin disnea, sin dolor torácico.</div>
          </ProtoStep>

          {/* Step 4 — done */}
          <ProtoStep n="04" title="Examen físico" status="done" sub="Lista del protocolo · 4 de 4 verificados">
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

          {/* Step 5 — current decision branch */}
          <ProtoStep n="05" title="Decisión clínica" status="active" sub="Algoritmo · ¿Alcanza meta de PA <130/80?">
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
              <div style={{padding: '12px 14px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5}}>
                <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4}}>Sí · en meta</div>
                <div style={{fontSize: 12.5, color: 'var(--color-n-700)', lineHeight: 1.4}}>Mantener tratamiento, control en 3 meses.</div>
              </div>
              <div style={{padding: '12px 14px', background: 'var(--color-p-50)', border: '2px solid var(--color-p-500)', borderRadius: 5, position: 'relative'}}>
                <span style={{position: 'absolute', top: 8, right: 8, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-p-700)', textTransform: 'uppercase'}}>Seleccionado</span>
                <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4}}>No · fuera de meta</div>
                <div style={{fontSize: 12.5, color: 'var(--color-n-800)', lineHeight: 1.4}}>Agregar BCC (Amlodipino 5mg) · evaluar adherencia · control en 4 semanas.</div>
              </div>
            </div>
          </ProtoStep>

          {/* Step 6 — upcoming */}
          <ProtoStep n="06" title="Tratamiento" status="next" sub="Tabla de dosificación del protocolo">
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
            <div style={{display: 'flex', gap: 6, marginTop: 10}}>
              <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-n-600)', border: '1px dashed var(--color-n-200)', background: 'transparent', borderRadius: 3}}>+ Añadir medicamento</button>
              <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-p-700)', border: '1px solid var(--color-p-300)', background: 'var(--color-p-50)', borderRadius: 3}}>Generar receta de esta tabla</button>
            </div>
          </ProtoStep>
        </div>

        {/* Right rail — patient context only, protocol owns center */}
        <div style={{padding: '20px 24px 20px 12px', borderLeft: '1px solid var(--color-n-100)'}}>
          <div style={{marginBottom: 18}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
              <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
            </div>
          </div>
          <div style={{marginBottom: 18}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Resultado SOAP</div>
            <div style={{fontSize: 11.5, color: 'var(--color-n-500)', lineHeight: 1.5}}>
              Las notas SOAP se llenan automáticamente desde los pasos del protocolo. Puedes editarlas antes de firmar.
            </div>
            <div style={{marginTop: 8, padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4}}>
              {['Subjetivo', 'Objetivo', 'Evaluación', 'Plan'].map(k => (
                <div key={k} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0'}}>
                  <span style={{fontSize: 12, color: 'var(--color-n-700)'}}>{k}</span>
                  <i className="ph ph-check-circle" style={{fontSize: 13, color: 'var(--color-success-text)'}}/>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Órdenes en cola</div>
            <div style={{padding: '8px 10px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 4, fontSize: 12, color: 'var(--color-n-700)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Receta</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>2 fármacos</span></div>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Laboratorio</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
              <div style={{display: 'flex', justifyContent: 'space-between', padding: '2px 0'}}><span>Imagen</span><span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-500)'}}>0</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProtoStep = ({n, title, status, sub, children}) => {
  const styles = {
    done:   {ring: 'var(--color-p-500)', text: 'var(--color-p-700)', bg: 'var(--color-p-500)', icon: 'ph-check', iconColor: '#fff'},
    active: {ring: 'var(--color-p-500)', text: 'var(--color-p-700)', bg: 'var(--color-p-50)', icon: '', iconColor: 'var(--color-p-700)'},
    next:   {ring: 'var(--color-n-200)', text: 'var(--color-n-500)', bg: '#fff', icon: '', iconColor: 'var(--color-n-500)'},
  }[status];
  return (
    <div style={{display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14, marginBottom: 18, opacity: status === 'next' ? 0.7 : 1}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{width: 28, height: 28, borderRadius: '50%', background: styles.bg, border: `1.5px solid ${styles.ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: styles.iconColor, fontWeight: 600}}>
          {styles.icon ? <i className={`ph ${styles.icon}`} style={{fontSize: 13}}/> : n}
        </div>
        <div style={{flex: 1, width: 1, background: 'var(--color-n-200)', marginTop: 4}}/>
      </div>
      <div style={{paddingBottom: 6}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: sub ? 2 : 8}}>
          <h3 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 17, color: 'var(--color-n-900)', margin: 0}}>{title}</h3>
          {status === 'active' && <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: 'var(--color-p-50)', border: '1px solid var(--color-p-100)', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em'}}>En curso</span>}
        </div>
        {sub && <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginBottom: 10}}>{sub}</div>}
        <div style={{background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, padding: '12px 14px'}}>{children}</div>
      </div>
    </div>
  );
};

window.OptionProtocolFirst = OptionProtocolFirst;
