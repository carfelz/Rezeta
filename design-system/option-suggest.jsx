/* === OPTION B — SMART SUGGEST =============================================
   The protocol surface stays in the right rail BUT the system actively
   detects the chief complaint and proposes a matching protocol with one-
   click apply. Lowest-friction change to existing layout. */
const OptionSuggest = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader/>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, padding: '20px 28px', overflow: 'auto'}}>
        <div>
          <SOAPCard title="Motivo de consulta" accent>
            <div style={{fontSize: 13.5, color: 'var(--color-n-700)', lineHeight: 1.55, padding: '4px 0'}}>
              Seguimiento HTA. Refiere cefaleas ocasionales, presión 145/92 en casa.
            </div>
          </SOAPCard>

          {/* Protocol suggestion banner — appears the moment a recognizable
              condition is typed. Tight, declarative, one click to apply. */}
          <div style={{background: 'var(--color-p-50)', border: '1px solid var(--color-p-100)', borderRadius: 5, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14}}>
            <div style={{width: 32, height: 32, background: 'var(--color-p-500)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <i className="ph ph-magic-wand" style={{fontSize: 16, color: '#fff'}}/>
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 12.5, color: 'var(--color-p-900)', fontWeight: 500}}>
                Protocolo sugerido <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)', background: '#fff', border: '1px solid var(--color-p-100)', padding: '1px 5px', borderRadius: 3, marginLeft: 6}}>HTA seguimiento · v2</span>
              </div>
              <div style={{fontSize: 11.5, color: 'var(--color-p-700)', marginTop: 2}}>
                Detectado por motivo de consulta. Cubre signos vitales, evaluación, ajuste farmacológico y receta.
              </div>
            </div>
            <button style={{padding: '6px 10px', fontSize: 11.5, color: 'var(--color-n-600)', background: 'transparent', border: '1px solid transparent', borderRadius: 3}}>Descartar</button>
            <button style={{padding: '6px 14px', fontSize: 12, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 3, fontWeight: 500}}>
              Aplicar protocolo
            </button>
          </div>

          <SOAPCard title="Signos vitales" accent sub="Pre-poblado por protocolo · 5 campos requeridos">
            <VitalsGrid values={{pa: '145 / 92', fc: '78', t: '36.8', sat: '98', peso: '74.2', talla: '168'}}/>
          </SOAPCard>
          <SOAPCard title="Subjetivo">
            <FieldGhost multiline height={50} value="Cefaleas ocasionales en últimas 2 semanas, sin disnea ni dolor torácico. Adherencia a Losartán 50mg parcial — olvida dosis nocturna."/>
          </SOAPCard>
          <SOAPCard title="Evaluación" accent sub="Guía del protocolo">
            <div style={{padding: '8px 12px', background: 'var(--color-n-25)', border: '1px solid var(--color-n-100)', borderRadius: 4, fontSize: 12, color: 'var(--color-n-600)', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8}}>
              <i className="ph ph-quotes" style={{fontSize: 12, color: 'var(--color-p-500)', marginTop: 2}}/>
              <span>Primera línea: IECA (Enalapril) o ARA-II (Losartán). Meta PA &lt;130/80. Si no alcanza meta con 1 fármaco, agregar BCC (Amlodipino).</span>
            </div>
            <FieldGhost multiline value="HTA estadio 1 sin daño de órgano blanco. Adherencia subóptima. Continúa Losartán, refuerza adherencia."/>
          </SOAPCard>
          <SOAPCard title="Plan">
            <FieldGhost multiline height={50}/>
          </SOAPCard>
        </div>

        <div>
          <div style={{marginBottom: 14}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas del paciente</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
              <AlertChip tone="warn" icon="ph-info" label="HTA esencial · 4 años"/>
              <AlertChip tone="warn" icon="ph-info" label="Ansiedad generalizada"/>
            </div>
          </div>

          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>Sugerencias para esta consulta</div>
            </div>
            {[
              {title: 'HTA seguimiento', sub: 'Coincide con motivo · usado 47 veces', match: 96, primary: true},
              {title: 'Evaluación cardiovascular integral', sub: 'Coincide por edad + HTA', match: 71},
              {title: 'Ansiedad — tamizaje GAD-7', sub: 'Comorbilidad detectada', match: 63},
            ].map((p, i) => (
              <div key={i} style={{padding: '10px 12px', background: '#fff', border: `1px solid ${p.primary ? 'var(--color-p-300)' : 'var(--color-n-200)'}`, borderRadius: 5, marginBottom: 6, position: 'relative'}}>
                {p.primary && <span style={{position: 'absolute', left: -1, top: 8, bottom: 8, width: 2, background: 'var(--color-p-500)'}}/>}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8}}>
                  <div style={{fontSize: 13, color: 'var(--color-n-900)', fontWeight: 500}}>{p.title}</div>
                  <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-p-700)'}}>{p.match}%</span>
                </div>
                <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginTop: 2}}>{p.sub}</div>
              </div>
            ))}
            <button style={{width: '100%', padding: '8px', marginTop: 4, fontSize: 12, color: 'var(--color-n-600)', background: 'transparent', border: '1px dashed var(--color-n-200)', borderRadius: 3}}>+ Buscar otro protocolo</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OptionSuggest = OptionSuggest;
