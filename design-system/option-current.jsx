/* === OPTION A — CURRENT STATE (for comparison) ============================
   The protocol is a passive empty card in the right rail. Doctors don't
   notice it; even when they do, applying it is one extra step. */
const OptionCurrent = () => (
  <div style={{display: 'flex', height: '100%', background: 'var(--color-n-25)'}}>
    <Sidebar/>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
      <TopBar/>
      <ConsultHeader/>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '20px 28px', overflow: 'auto'}}>
        <div>
          <SOAPCard title="Motivo de consulta">
            <FieldGhost multiline placeholder="Seguimiento trimestral, motivo de consulta, síntomas principales…"/>
          </SOAPCard>
          <SOAPCard title="Signos vitales">
            <VitalsGrid/>
          </SOAPCard>
          <SOAPCard title="Subjetivo">
            <FieldGhost multiline height={60} placeholder="Historia del paciente, síntomas, antecedentes relevantes, contexto clínico…"/>
          </SOAPCard>
          <SOAPCard title="Examen físico">
            <FieldGhost multiline height={60}/>
          </SOAPCard>
          <SOAPCard title="Evaluación">
            <FieldGhost multiline height={60}/>
          </SOAPCard>
          <SOAPCard title="Plan">
            <FieldGhost multiline height={60} placeholder="Tratamiento, indicaciones, estudios solicitados, seguimiento…"/>
          </SOAPCard>
        </div>
        <div>
          <div style={{marginBottom: 14}}>
            <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)', marginBottom: 8}}>Alertas del paciente</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <AlertChip tone="danger" icon="ph-warning-circle" label="Alergia · Metformina"/>
              <AlertChip tone="warn" icon="ph-info" label="Síndrome de intestino irritable"/>
              <AlertChip tone="warn" icon="ph-info" label="Ansiedad generalizada"/>
            </div>
          </div>
          <div style={{marginBottom: 14}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>Protocolos</div>
              <button style={{fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-n-200)', borderRadius: 3, background: '#fff', color: 'var(--color-n-700)'}}>+ Agregar</button>
            </div>
            <div style={{padding: '24px 16px', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, textAlign: 'center'}}>
              <i className="ph ph-stack" style={{fontSize: 22, color: 'var(--color-n-300)'}}/>
              <div style={{fontSize: 12, color: 'var(--color-n-500)', marginTop: 8}}>Agrega un protocolo para guiar esta consulta.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.OptionCurrent = OptionCurrent;
