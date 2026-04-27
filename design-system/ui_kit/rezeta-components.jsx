/**
 * ui_kits/web_app/rezeta-components.jsx
 * Rezeta-specific surfaces that don't have direct shadcn equivalents:
 * Sidebar (with 2px teal active rule), TopBar, ProtocolBlock, SOAP layout.
 */

const RZ_NAV = [
  { section: 'Clínico', items: [
    { id:'dashboard', icon:'ph-house', label:'Dashboard' },
    { id:'agenda', icon:'ph-calendar-blank', label:'Agenda', count:'7' },
    { id:'pacientes', icon:'ph-users', label:'Pacientes', count:'248' },
    { id:'protocolos', icon:'ph-list-checks', label:'Protocolos', count:'34' },
  ]},
  { section: 'Administración', items: [
    { id:'facturacion', icon:'ph-receipt', label:'Facturación' },
    { id:'ajustes', icon:'ph-gear-six', label:'Ajustes' },
  ]},
];

const Sidebar = ({active, onNav}) => (
  <aside className="bg-[color:var(--sidebar)] border-r border-[color:var(--color-n-200)] flex flex-col py-5 sticky top-0 h-screen w-[240px] flex-shrink-0">
    <div className="px-5 pb-5 mb-3.5 border-b border-[color:var(--color-n-100)] flex items-center gap-2.5">
      <div className="w-7 h-7 bg-[color:var(--primary)] rounded-[3px] flex items-center justify-center text-white font-serif font-medium text-[16px]">R</div>
      <div className="font-serif font-medium text-[18px] text-[color:var(--color-n-900)] tracking-[-0.01em]">Rezeta</div>
    </div>
    {RZ_NAV.map((sec, i) => (
      <div key={i}>
        <div className="px-5 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-n-400)]">{sec.section}</div>
        {sec.items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={()=>onNav?.(it.id)}
              className={cn('relative w-full flex items-center gap-2.5 px-5 py-[7px] text-[13px] transition-colors',
                isActive
                  ? 'bg-[color:var(--card)] text-[color:var(--color-n-900)] font-medium before:content-[""] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-[color:var(--primary)]'
                  : 'text-[color:var(--color-n-600)] hover:bg-[color:var(--color-n-50)] hover:text-[color:var(--color-n-800)]')}>
              <i className={cn('ph', it.icon, isActive ? 'text-[color:var(--primary)]' : 'text-[color:var(--color-n-500)]')} style={{fontSize:16}}/>
              <span className="flex-1 text-left">{it.label}</span>
              {it.count && <span className="font-mono text-[11px] text-[color:var(--color-n-400)]">{it.count}</span>}
            </button>
          );
        })}
      </div>
    ))}
    <div className="mt-auto px-3.5 pt-3 border-t border-[color:var(--color-n-100)]">
      <div className="flex items-center gap-2.5 p-2 rounded-[3px] hover:bg-[color:var(--color-n-50)] cursor-pointer">
        <div className="w-8 h-8 rounded-full bg-[color:var(--color-p-50)] text-[color:var(--color-p-700)] flex items-center justify-center font-semibold text-[12px]">RN</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12.5px] text-[color:var(--color-n-800)] truncate">Dr. Rafael Núñez</div>
          <div className="text-[11px] text-[color:var(--color-n-500)]">Cardiología</div>
        </div>
        <i className="ph ph-caret-up-down text-[color:var(--color-n-400)]" style={{fontSize:14}}/>
      </div>
    </div>
  </aside>
);

const TopBar = ({onCmdK, onNotify}) => (
  <header className="bg-[color:var(--card)] border-b border-[color:var(--color-n-200)] h-14 flex items-center px-6 gap-4 sticky top-0 z-20">
    <button className="flex items-center gap-2 px-2.5 py-1.5 border border-[color:var(--color-n-200)] rounded-[3px] hover:bg-[color:var(--color-n-50)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)]"/>
      <div className="text-left">
        <div className="text-[13px] text-[color:var(--color-n-800)] font-medium leading-tight">Centro Médico Real</div>
        <div className="text-[11.5px] text-[color:var(--color-n-500)] leading-tight">Naco · martes</div>
      </div>
      <i className="ph ph-caret-down text-[color:var(--color-n-400)] ml-1" style={{fontSize:13}}/>
    </button>
    <button onClick={onCmdK} className="flex-1 max-w-[480px] relative">
      <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-n-400)]" style={{fontSize:16}}/>
      <div className="h-[34px] w-full pl-9 pr-3 border border-[color:var(--color-n-200)] rounded-[3px] bg-[color:var(--card)] text-[13px] text-[color:var(--color-n-400)] flex items-center text-left">Buscar paciente, protocolo, factura…</div>
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[color:var(--color-n-500)] border border-[color:var(--color-n-200)] bg-[color:var(--color-n-25)] px-1.5 py-[2px] rounded-[3px]">⌘K</kbd>
    </button>
    <div className="ml-auto flex items-center gap-3">
      <button onClick={onNotify} className="relative w-[34px] h-[34px] flex items-center justify-center rounded-[3px] text-[color:var(--color-n-600)] hover:bg-[color:var(--color-n-50)]">
        <i className="ph ph-bell" style={{fontSize:18}}/>
        <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[color:var(--destructive)] rounded-full border-[1.5px] border-white"/>
      </button>
      <button className="w-[34px] h-[34px] flex items-center justify-center rounded-[3px] text-[color:var(--color-n-600)] hover:bg-[color:var(--color-n-50)]"><i className="ph ph-question" style={{fontSize:18}}/></button>
      <div className="flex items-center gap-2.5 pl-3.5 border-l border-[color:var(--color-n-200)]">
        <div className="w-8 h-8 rounded-full bg-[color:var(--color-p-50)] text-[color:var(--color-p-700)] flex items-center justify-center font-semibold text-[12px]">RN</div>
        <div>
          <div className="font-semibold text-[12.5px] text-[color:var(--color-n-800)] leading-tight">Dr. Rafael Núñez</div>
          <div className="text-[11.5px] text-[color:var(--color-n-500)] leading-tight">Cardiología</div>
        </div>
      </div>
    </div>
  </header>
);

/* Protocol block — Rezeta's signature surface */
const PBlock = ({type, title, children, nested, dragHandle=true, actions=true}) => (
  <div className={cn('rounded-[5px] border border-[color:var(--color-n-200)] bg-[color:var(--card)] mb-3', nested && 'ml-7 border-l border-l-[color:var(--color-n-200)]')}>
    <div className={cn('relative flex items-center gap-3 px-4 py-3 pl-[18px] border-b border-[color:var(--color-n-100)]',
      nested ? 'bg-[color:var(--card)]' : 'bg-[color:var(--color-n-25)]')}>
      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[color:var(--primary)] rounded-tl-[5px]"/>
      {dragHandle && <i className="ph ph-dots-six-vertical text-[color:var(--color-n-300)] cursor-grab" style={{fontSize:14}}/>}
      {type && <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--color-p-700)] bg-[color:var(--color-p-50)] border border-[color:var(--color-p-100)] px-1.5 py-[2px] rounded-[3px]">{type}</span>}
      <h3 className="font-serif font-medium text-[17px] text-[color:var(--color-n-900)] m-0 flex-1 min-w-0 truncate">{title}</h3>
      {actions && (
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded-[3px] hover:bg-[color:var(--color-n-100)] flex items-center justify-center text-[color:var(--color-n-500)]"><i className="ph ph-pencil-simple" style={{fontSize:13}}/></button>
          <button className="w-7 h-7 rounded-[3px] hover:bg-[color:var(--color-n-100)] flex items-center justify-center text-[color:var(--color-n-500)]"><i className="ph ph-dots-three" style={{fontSize:14}}/></button>
        </div>
      )}
    </div>
    <div className="p-4 px-[18px]">{children}</div>
  </div>
);

const PListItem = ({done, critical, children}) => (
  <div className={cn('flex items-start gap-3 py-2 px-2 rounded-[3px] hover:bg-[color:var(--color-n-25)]')}>
    <Checkbox checked={done}/>
    <div className="flex-1 min-w-0">
      <div className={cn('text-[13.5px] leading-[1.5]',
        done ? 'text-[color:var(--color-n-400)] line-through' : 'text-[color:var(--color-n-700)]')}>{children}</div>
      {critical && <div className="font-mono text-[11.5px] text-[color:var(--destructive)] uppercase tracking-[0.06em] mt-1">⚠ Crítico</div>}
    </div>
  </div>
);

const PageHead = ({kicker, title, sub, actions}) => (
  <div className="flex items-end justify-between gap-4 mb-6">
    <div>
      {kicker && <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)] mb-1.5">{kicker}</div>}
      <h1 className="font-serif font-medium text-[30px] leading-[1.15] tracking-[-0.015em] text-[color:var(--color-n-900)] m-0">{title}</h1>
      {sub && <p className="text-[13px] text-[color:var(--color-n-500)] m-0 mt-1">{sub}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

const Callout = ({variant='info', title, children, icon}) => {
  const map = {
    success:{bg:'var(--color-success-bg)',br:'var(--color-success-border)',tx:'var(--color-success-text)',ic:'ph-check-circle'},
    warning:{bg:'var(--color-warning-bg)',br:'var(--color-warning-border)',tx:'var(--color-warning-text)',ic:'ph-warning'},
    danger: {bg:'var(--color-danger-bg)',br:'var(--color-danger-border)',tx:'var(--color-danger-text)',ic:'ph-x-circle'},
    info:   {bg:'var(--color-info-bg)',br:'var(--color-info-border)',tx:'var(--color-info-text)',ic:'ph-info'},
  }[variant];
  return (
    <div className="flex gap-3 p-3.5 px-4 rounded-[5px] border" style={{background:map.bg, borderColor:map.br, color:map.tx}}>
      <i className={`ph ${icon||map.ic} flex-shrink-0`} style={{fontSize:18, marginTop:1}}/>
      <div className="flex-1 min-w-0">
        {title && <div className="font-sans font-semibold text-[13px] mb-0.5">{title}</div>}
        <div className="text-[13px] leading-[1.45]">{children}</div>
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, TopBar, PBlock, PListItem, PageHead, Callout });
