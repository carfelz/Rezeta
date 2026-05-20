/* Shared shell — top bar, breadcrumb, header, sidebar — used inside every artboard
   so each option reads as a real screen, not a fragment. */

const Sidebar = () => (
  <aside style={{width: 200, background: 'var(--color-n-25)', borderRight: '1px solid var(--color-n-200)', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 0'}}>
    <div style={{padding: '0 18px 14px', borderBottom: '1px solid var(--color-n-100)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8}}>
      <div style={{width: 24, height: 24, background: 'var(--color-p-500)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500}}>R</div>
      <div style={{fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--color-n-900)'}}>Rezeta</div>
    </div>
    {[
      {sec: 'Clínico', items: [['ph-house','Dashboard'],['ph-calendar-blank','Agenda','7'],['ph-users','Pacientes','248'],['ph-list-checks','Protocolos','34']]},
      {sec: 'Administración', items: [['ph-receipt','Facturación'],['ph-gear-six','Ajustes']]},
    ].map((s, i) => (
      <div key={i}>
        <div style={{padding: '10px 18px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-n-400)'}}>{s.sec}</div>
        {s.items.map(([icon, label, count]) => {
          const active = label === 'Pacientes';
          return (
            <div key={label} style={{position: 'relative', padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: active ? 'var(--color-n-900)' : 'var(--color-n-600)', fontWeight: active ? 500 : 400, background: active ? '#fff' : 'transparent'}}>
              {active && <span style={{position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, background: 'var(--color-p-500)'}}/>}
              <i className={`ph ${icon}`} style={{fontSize: 15, color: active ? 'var(--color-p-500)' : 'var(--color-n-500)'}}/>
              <span style={{flex: 1}}>{label}</span>
              {count && <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-n-400)'}}>{count}</span>}
            </div>
          );
        })}
      </div>
    ))}
    <div style={{marginTop: 'auto', padding: '12px 14px 0', borderTop: '1px solid var(--color-n-100)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 9, padding: 6}}>
        <div style={{width: 28, height: 28, borderRadius: '50%', background: 'var(--color-p-50)', color: 'var(--color-p-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11}}>DT</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontWeight: 600, fontSize: 12, color: 'var(--color-n-800)'}}>Dr. Test García</div>
          <div style={{fontSize: 10.5, color: 'var(--color-n-500)'}}>Medicina General</div>
        </div>
      </div>
    </div>
  </aside>
);

const TopBar = () => (
  <header style={{height: 52, background: '#fff', borderBottom: '1px solid var(--color-n-200)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', border: '1px solid var(--color-n-200)', borderRadius: 3}}>
      <span style={{width: 6, height: 6, borderRadius: '50%', background: 'var(--color-p-500)'}}/>
      <div>
        <div style={{fontSize: 12, color: 'var(--color-n-800)', fontWeight: 500, lineHeight: 1.2}}>Consultorio Privado Dr. García</div>
        <div style={{fontSize: 10.5, color: 'var(--color-n-500)', lineHeight: 1.2}}>Santo Domingo</div>
      </div>
      <i className="ph ph-caret-down" style={{fontSize: 12, color: 'var(--color-n-400)', marginLeft: 4}}/>
    </div>
    <div style={{flex: 1, maxWidth: 420, position: 'relative'}}>
      <i className="ph ph-magnifying-glass" style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-n-400)'}}/>
      <div style={{height: 30, paddingLeft: 32, paddingRight: 8, border: '1px solid var(--color-n-200)', borderRadius: 3, fontSize: 12, color: 'var(--color-n-400)', display: 'flex', alignItems: 'center'}}>Buscar pacientes, citas…</div>
      <span style={{position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-500)', border: '1px solid var(--color-n-200)', background: 'var(--color-n-25)', padding: '1px 6px', borderRadius: 3}}>⌘K</span>
    </div>
    <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12}}>
      <i className="ph ph-bell" style={{fontSize: 16, color: 'var(--color-n-600)'}}/>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid var(--color-n-200)'}}>
        <div style={{width: 28, height: 28, borderRadius: '50%', background: 'var(--color-p-50)', color: 'var(--color-p-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11}}>DT</div>
        <div>
          <div style={{fontWeight: 600, fontSize: 12, color: 'var(--color-n-800)', lineHeight: 1.2}}>Dr. Test García</div>
          <div style={{fontSize: 10.5, color: 'var(--color-n-500)', lineHeight: 1.2}}>Medicina General</div>
        </div>
      </div>
    </div>
  </header>
);

const ConsultHeader = ({rightSlot, kicker = 'SÁBADO, 2 DE MAYO DE 2026 · 02:29 A.M. · CONSULTORIO PRIVADO DR. GARCÍA'}) => (
  <div style={{padding: '20px 28px 16px', borderBottom: '1px solid var(--color-n-100)', background: '#fff', display: 'flex', alignItems: 'flex-end', gap: 24}}>
    <div style={{flex: 1}}>
      <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginBottom: 6}}>
        <span style={{color: 'var(--color-n-700)'}}>Pacientes</span>
        <span style={{margin: '0 6px', color: 'var(--color-n-300)'}}>›</span>
        <span style={{color: 'var(--color-n-700)'}}>Isabel Cristina Cruz</span>
        <span style={{margin: '0 6px', color: 'var(--color-n-300)'}}>›</span>
        <strong style={{color: 'var(--color-n-900)', fontWeight: 600}}>Consulta · 2 may de 2026</strong>
      </div>
      <div style={{fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-n-400)', marginBottom: 4}}>{kicker}</div>
      <h1 style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 30, color: 'var(--color-n-900)', margin: 0, lineHeight: 1.1}}>Nueva consulta</h1>
      <div style={{fontSize: 13, color: 'var(--color-n-500)', marginTop: 4}}>Isabel Cristina Cruz · Dr. Test García</div>
    </div>
    {rightSlot || (
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-n-600)', background: 'transparent', border: '1px solid var(--color-n-200)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6}}>
          <span style={{width: 5, height: 5, borderRadius: '50%', background: 'var(--color-n-400)'}}/>Sin guardar
        </button>
        <button style={{padding: '6px 12px', fontSize: 12, color: 'var(--color-n-700)', background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 3}}>Guardar borrador</button>
        <button style={{padding: '6px 12px', fontSize: 12, color: '#fff', background: 'var(--color-p-500)', border: '1px solid var(--color-p-500)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6}}>
          <i className="ph ph-check" style={{fontSize: 12}}/>Firmar y cerrar
        </button>
      </div>
    )}
  </div>
);

/* Original SOAP card style — re-used everywhere */
const SOAPCard = ({title, sub, children, accent}) => (
  <div style={{background: '#fff', border: '1px solid var(--color-n-200)', borderRadius: 5, padding: '14px 18px 16px', marginBottom: 12, position: 'relative'}}>
    {accent && <span style={{position: 'absolute', left: -1, top: 10, bottom: 10, width: 2, background: 'var(--color-p-500)', borderRadius: 1}}/>}
    <div style={{fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--color-n-900)', marginBottom: sub ? 2 : 8}}>{title}</div>
    {sub && <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginBottom: 8}}>{sub}</div>}
    {children}
  </div>
);

const FieldGhost = ({placeholder, value, multiline, height = 50}) => (
  <div style={{minHeight: multiline ? height : 30, padding: multiline ? '8px 0' : '6px 0', fontSize: 13, color: value ? 'var(--color-n-700)' : 'var(--color-n-400)', lineHeight: 1.55}}>
    {value || placeholder}
  </div>
);

const SmallInput = ({label, suffix, value}) => (
  <div>
    <div style={{fontSize: 11.5, color: 'var(--color-n-500)', marginBottom: 4}}>{label}</div>
    <div style={{height: 30, border: '1px solid var(--color-n-200)', borderRadius: 3, display: 'flex', alignItems: 'center', padding: '0 9px', fontSize: 12, color: value ? 'var(--color-n-700)' : 'var(--color-n-400)', background: '#fff', justifyContent: 'space-between'}}>
      <span>{value || '—'}</span>
      {suffix && <span style={{fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-n-400)'}}>{suffix}</span>}
    </div>
  </div>
);

const VitalsGrid = ({values = {}}) => (
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px'}}>
    <SmallInput label="Presión arterial" suffix="mmHg" value={values.pa}/>
    <SmallInput label="Frec. cardiaca" suffix="lpm" value={values.fc}/>
    <SmallInput label="Temperatura" suffix="°C" value={values.t}/>
    <SmallInput label="Saturación O₂" suffix="%" value={values.sat}/>
    <SmallInput label="Peso" suffix="kg" value={values.peso}/>
    <SmallInput label="Talla" suffix="cm" value={values.talla}/>
  </div>
);

const AlertChip = ({tone, icon, label}) => {
  const tones = {
    danger: ['#F6EAE8', '#D9B4AE', '#7A2B22'],
    warn:   ['#F7F1E3', '#DCC89A', '#6E5319'],
    info:   ['#ECF0F3', '#B8C6D0', '#2B435A'],
  }[tone] || ['#ECF0F3', '#B8C6D0', '#2B435A'];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: tones[0], border: `1px solid ${tones[1]}`, borderRadius: 3, fontSize: 12.5, color: tones[2], fontWeight: 500}}>
      <i className={`ph ${icon}`} style={{fontSize: 14}}/>
      {label}
    </div>
  );
};

window.Sidebar = Sidebar;
window.TopBar = TopBar;
window.ConsultHeader = ConsultHeader;
window.SOAPCard = SOAPCard;
window.FieldGhost = FieldGhost;
window.SmallInput = SmallInput;
window.VitalsGrid = VitalsGrid;
window.AlertChip = AlertChip;
