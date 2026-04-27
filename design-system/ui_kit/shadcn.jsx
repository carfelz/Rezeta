/**
 * ui-kits/web_app/shadcn.jsx
 *
 * Rezeta-flavored shadcn/ui primitives. Vanilla React + Tailwind classes that
 * reference the shadcn CSS variables defined in shadcn-tokens.css. No Radix —
 * we re-implement just enough behavior for a hi-fi click-through, kept faithful
 * to shadcn's API surface.
 *
 * Exports to window so other Babel scripts can import.
 */

const { useState, useRef, useEffect, useCallback, createContext, useContext, Fragment } = React;

/* ─────────────── cn helper ─────────────── */
const cn = (...xs) => xs.filter(Boolean).join(' ');

/* ─────────────── Button ─────────────── */
const buttonVariants = {
  variant: {
    default:     'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[#1B3A41] active:bg-[#0E2429]',
    secondary:   'bg-[color:var(--card)] text-[color:var(--secondary-foreground)] border border-[color:var(--input)] hover:bg-[color:var(--secondary)]',
    ghost:       'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]',
    destructive: 'bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[#6E2018]',
    outline:     'border border-[color:var(--border)] bg-transparent text-[color:var(--foreground)] hover:bg-[color:var(--accent)]',
    link:        'text-[color:var(--primary)] underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-8 px-4 text-[13px]',
    sm:      'h-7 px-3 text-[12.5px]',
    lg:      'h-10 px-[18px] text-[14px]',
    icon:    'h-8 w-8 p-0',
  }
};
const Button = React.forwardRef(({ variant='default', size='default', className='', children, ...p }, ref) => (
  <button ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ring)]/40 disabled:pointer-events-none disabled:opacity-50 disabled:bg-[color:var(--color-n-50)] disabled:text-[color:var(--color-n-400)]',
      buttonVariants.variant[variant], buttonVariants.size[size], className
    )} {...p}>{children}</button>
));

/* ─────────────── Input ─────────────── */
const Input = React.forwardRef(({ className='', ...p }, ref) => (
  <input ref={ref}
    className={cn(
      'h-[34px] w-full rounded-[3px] border border-[color:var(--input)] bg-[color:var(--card)] px-3 text-[13px] text-[color:var(--foreground)] placeholder:text-[color:var(--color-n-400)] focus-visible:outline-none focus-visible:border-[color:var(--primary)] focus-visible:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] disabled:bg-[color:var(--color-n-50)] disabled:text-[color:var(--color-n-400)] disabled:cursor-not-allowed',
      className
    )} {...p} />
));

/* ─────────────── Textarea ─────────────── */
const Textarea = React.forwardRef(({ className='', ...p }, ref) => (
  <textarea ref={ref}
    className={cn(
      'w-full min-h-[80px] rounded-[3px] border border-[color:var(--input)] bg-[color:var(--card)] p-3 text-[13px] text-[color:var(--foreground)] leading-[1.55] placeholder:text-[color:var(--color-n-400)] focus-visible:outline-none focus-visible:border-[color:var(--primary)] focus-visible:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] resize-y',
      className
    )} {...p} />
));

/* ─────────────── Label ─────────────── */
const Label = ({ className='', children, required, ...p }) => (
  <label className={cn('block font-medium text-[12.5px] text-[color:var(--color-n-700)] mb-[6px]', className)} {...p}>
    {children}
    {required && <span className="text-[color:var(--destructive)] ml-1">*</span>}
  </label>
);

/* ─────────────── Card ─────────────── */
const Card = ({ className='', selected, children, ...p }) => (
  <div
    className={cn(
      'relative rounded-[5px] border bg-[color:var(--card)] p-5',
      selected
        ? 'border-[color:var(--primary)] before:content-[""] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:bg-[color:var(--primary)] before:rounded-r'
        : 'border-[color:var(--border)]',
      className
    )} {...p}>{children}</div>
);
const CardHeader = ({className='', children}) => <div className={cn('flex flex-col gap-1 mb-3', className)}>{children}</div>;
const CardTitle  = ({className='', children}) => <h3 className={cn('font-sans font-semibold text-[14px] text-[color:var(--color-n-800)] m-0', className)}>{children}</h3>;
const CardDescription = ({className='', children}) => <p className={cn('text-[12.5px] text-[color:var(--color-n-500)] m-0 leading-[1.45]', className)}>{children}</p>;
const CardContent = ({className='', children}) => <div className={cn('text-[13px] text-[color:var(--color-n-700)]', className)}>{children}</div>;
const CardFooter = ({className='', children}) => <div className={cn('flex items-center pt-3 mt-3 border-t border-[color:var(--color-n-100)]', className)}>{children}</div>;

/* ─────────────── Badge ─────────────── */
const badgeVariants = {
  draft:    'bg-[color:var(--color-n-50)] border-[color:var(--color-n-200)] text-[color:var(--color-n-600)]',
  signed:   'bg-[color:var(--color-p-50)] border-[color:var(--color-p-100)] text-[color:var(--color-p-700)]',
  active:   'bg-[color:var(--color-success-bg)] border-[color:var(--color-success-border)] text-[color:var(--color-success-text)]',
  paid:     'bg-[color:var(--color-success-bg)] border-[color:var(--color-success-border)] text-[color:var(--color-success-text)]',
  review:   'bg-[color:var(--color-warning-bg)] border-[color:var(--color-warning-border)] text-[color:var(--color-warning-text)]',
  overdue:  'bg-[color:var(--color-danger-bg)] border-[color:var(--color-danger-border)] text-[color:var(--color-danger-text)]',
  archived: 'bg-[color:var(--color-n-50)] border-[color:var(--color-n-200)] text-[color:var(--color-n-500)]',
  info:     'bg-[color:var(--color-info-bg)] border-[color:var(--color-info-border)] text-[color:var(--color-info-text)]',
};
const Badge = ({variant='draft', dot=true, className='', children}) => (
  <span className={cn(
    'inline-flex items-center gap-1.5 px-2 py-[3px] text-[11.5px] font-medium rounded-[3px] border whitespace-nowrap',
    badgeVariants[variant], className
  )}>
    {dot && <span className="w-1.5 h-1.5 rounded-full" style={{background:'currentColor'}}/>}
    {children}
  </span>
);

/* ─────────────── Switch ─────────────── */
const Switch = ({checked, onCheckedChange, disabled, className=''}) => (
  <button role="switch" aria-checked={!!checked} disabled={disabled}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      'relative inline-flex h-[18px] w-[30px] flex-shrink-0 items-center rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ring)]/40',
      checked ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--color-n-300)]',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
    <span className={cn('inline-block h-[14px] w-[14px] rounded-full bg-white transition-transform duration-100',
      checked ? 'translate-x-[14px]' : 'translate-x-[2px]')}/>
  </button>
);

/* ─────────────── Checkbox ─────────────── */
const Checkbox = ({checked, indeterminate, onCheckedChange, disabled, className=''}) => (
  <button role="checkbox" aria-checked={!!checked} disabled={disabled}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      'h-4 w-4 rounded-[3px] border flex items-center justify-center transition-colors flex-shrink-0',
      checked || indeterminate ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white' : 'bg-white border-[color:var(--color-n-400)]',
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ring)]/40',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
    {checked && !indeterminate && <i className="ph ph-check" style={{fontSize:11,fontWeight:'bold',lineHeight:1}}/>}
    {indeterminate && <span className="block w-2 h-[2px] bg-white"/>}
  </button>
);

/* ─────────────── Radio ─────────────── */
const RadioGroupContext = createContext(null);
const RadioGroup = ({value, onValueChange, children, className=''}) => (
  <RadioGroupContext.Provider value={{value, onValueChange}}>
    <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>{children}</div>
  </RadioGroupContext.Provider>
);
const RadioGroupItem = ({value, id, className=''}) => {
  const ctx = useContext(RadioGroupContext);
  const checked = ctx?.value === value;
  return (
    <button role="radio" aria-checked={checked} id={id}
      onClick={() => ctx?.onValueChange?.(value)}
      className={cn('h-4 w-4 rounded-full border flex items-center justify-center transition-colors',
        checked ? 'border-[color:var(--primary)]' : 'border-[color:var(--color-n-400)]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ring)]/40',
        className)}>
      {checked && <span className="block h-2 w-2 rounded-full bg-[color:var(--primary)]"/>}
    </button>
  );
};

/* ─────────────── Select (custom, shadcn-shaped API) ─────────────── */
const Select = ({value, onValueChange, options=[], placeholder='Selecciona…', className=''}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off);
  }, []);
  const current = options.find(o => o.value === value);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen(o=>!o)}
        className="h-[34px] w-full px-3 pr-8 text-left rounded-[3px] border border-[color:var(--input)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] flex items-center focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]">
        <span className={current ? '' : 'text-[color:var(--color-n-400)]'}>{current?.label ?? placeholder}</span>
        <i className="ph ph-caret-down absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-n-500)]" style={{fontSize:14}}/>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[5px] border border-[color:var(--border)] bg-[color:var(--popover)] shadow-[0_8px_24px_-8px_rgba(14,14,13,0.12),0_2px_6px_rgba(14,14,13,0.06)] py-1">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onValueChange?.(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] flex items-center justify-between">
              <span>{o.label}</span>
              {o.value === value && <i className="ph ph-check text-[color:var(--primary)]" style={{fontSize:13}}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────── Tabs ─────────────── */
const TabsContext = createContext(null);
const Tabs = ({value, onValueChange, defaultValue, children, className=''}) => {
  const [internal, setInternal] = useState(defaultValue);
  const v = value ?? internal;
  const set = onValueChange ?? setInternal;
  return <TabsContext.Provider value={{value:v, set}}><div className={className}>{children}</div></TabsContext.Provider>;
};
const TabsList = ({children, className=''}) => (
  <div className={cn('flex border-b border-[color:var(--border)]', className)}>{children}</div>
);
const TabsTrigger = ({value, children, count}) => {
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button onClick={()=>ctx.set(value)}
      className={cn('relative -mb-px inline-flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors',
        active ? 'text-[color:var(--color-n-900)] border-b-2 border-[color:var(--primary)]'
               : 'text-[color:var(--color-n-500)] hover:text-[color:var(--color-n-800)] border-b-2 border-transparent')}>
      {children}
      {count != null && <span className="font-mono text-[11px] text-[color:var(--color-n-400)]">{count}</span>}
    </button>
  );
};
const TabsContent = ({value, children, className=''}) => {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn('pt-5', className)}>{children}</div>;
};

/* ─────────────── Dialog ─────────────── */
const Dialog = ({open, onOpenChange, children}) => {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center" onClick={()=>onOpenChange?.(false)}>
      <div className="absolute inset-0 bg-[rgba(14,14,13,0.35)] animate-[fadeIn_150ms_ease]"/>
      <div onClick={e=>e.stopPropagation()} className="relative animate-[rise_150ms_ease]">{children}</div>
    </div>, document.body);
};
const DialogContent = ({children, className=''}) => (
  <div className={cn('w-[440px] max-w-[calc(100vw-32px)] rounded-[5px] bg-[color:var(--card)] shadow-[0_1px_0_rgba(14,14,13,0.04),0_8px_24px_-8px_rgba(14,14,13,0.12),0_2px_6px_rgba(14,14,13,0.06)] overflow-hidden', className)}>{children}</div>
);
const DialogHeader = ({children, className=''}) => <div className={cn('px-6 pt-5 pb-3.5 border-b border-[color:var(--color-n-100)]', className)}>{children}</div>;
const DialogTitle  = ({children, className=''}) => <h2 className={cn('font-serif font-medium text-[19px] text-[color:var(--color-n-900)] m-0 tracking-[-0.005em]', className)}>{children}</h2>;
const DialogDescription = ({children, className=''}) => <p className={cn('text-[13px] text-[color:var(--color-n-600)] m-0 mt-1', className)}>{children}</p>;
const DialogBody = ({children, className=''}) => <div className={cn('px-6 py-5', className)}>{children}</div>;
const DialogFooter = ({children, className=''}) => <div className={cn('flex justify-end gap-3 px-5 py-3.5 bg-[color:var(--color-n-25)] border-t border-[color:var(--color-n-100)]', className)}>{children}</div>;

/* ─────────────── Tooltip ─────────────── */
const Tooltip = ({children, content, side='top'}) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      {children}
      {open && (
        <span className={cn(
          'absolute z-50 px-2 py-1 rounded-[3px] bg-[color:var(--color-n-900)] text-[color:var(--color-n-25)] text-[11.5px] font-mono whitespace-nowrap pointer-events-none',
          side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
          side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-1.5',
          side === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-1.5'
        )}>{content}</span>
      )}
    </span>
  );
};

/* ─────────────── Table ─────────────── */
const Table = ({className='', children}) => <div className="rounded-[5px] border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden"><table className={cn('w-full border-collapse', className)}>{children}</table></div>;
const TableHeader = ({children}) => <thead className="bg-[color:var(--color-n-50)]">{children}</thead>;
const TableBody = ({children}) => <tbody>{children}</tbody>;
const TableRow = ({className='', selected, ...p}) => <tr className={cn('border-b border-[color:var(--color-n-100)] last:border-b-0 hover:bg-[color:var(--color-n-25)] transition-colors', selected && 'bg-[color:var(--color-n-25)]', className)} {...p}/>;
const TableHead = ({className='', children}) => <th className={cn('text-left font-sans font-semibold text-[11.5px] uppercase tracking-[0.06em] text-[color:var(--color-n-600)] px-4 py-3', className)}>{children}</th>;
const TableCell = ({className='', children, mono, name}) => <td className={cn('px-4 py-3 text-[13px] text-[color:var(--color-n-700)]', name && 'font-semibold text-[color:var(--color-n-800)]', mono && 'font-mono text-[12px] text-[color:var(--color-n-600)]', className)}>{children}</td>;

/* ─────────────── Dropdown menu ─────────────── */
const DropdownMenu = ({trigger, items=[], align='end'}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off);
  }, []);
  return (
    <span ref={ref} className="relative inline-flex">
      <span onClick={()=>setOpen(o=>!o)}>{trigger}</span>
      {open && (
        <div className={cn('absolute top-full mt-1 z-50 min-w-[200px] rounded-[5px] border border-[color:var(--border)] bg-[color:var(--popover)] shadow-[0_8px_24px_-8px_rgba(14,14,13,0.12),0_2px_6px_rgba(14,14,13,0.06)] py-1',
          align === 'end' ? 'right-0' : 'left-0')}>
          {items.map((it,i) => it.separator
            ? <div key={i} className="my-1 h-px bg-[color:var(--color-n-100)]"/>
            : it.label
              ? <div key={i} className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)]">{it.label}</div>
              : <button key={i} type="button" onClick={() => { it.onSelect?.(); setOpen(false); }}
                  className={cn('w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2',
                    it.danger ? 'text-[color:var(--destructive)] hover:bg-[color:var(--color-danger-bg)]'
                              : 'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]')}>
                  {it.icon && <i className={`ph ${it.icon}`} style={{fontSize:14, color: it.danger ? 'currentColor' : 'var(--color-n-500)'}}/>}
                  <span className="flex-1">{it.children}</span>
                  {it.shortcut && <span className="font-mono text-[10.5px] text-[color:var(--color-n-400)]">{it.shortcut}</span>}
                </button>
          )}
        </div>
      )}
    </span>
  );
};

/* ─────────────── Toast (Sonner-style) ─────────────── */
let toastQueue = []; let toastSetter = null;
const toast = (opts) => {
  const id = Math.random();
  const next = [...toastQueue, {id, ...opts}];
  toastQueue = next; toastSetter?.(next);
  setTimeout(() => { toastQueue = toastQueue.filter(t=>t.id!==id); toastSetter?.(toastQueue); }, opts.duration ?? 4500);
};
toast.success = (title, opts={}) => toast({...opts, title, variant:'success'});
toast.warning = (title, opts={}) => toast({...opts, title, variant:'warning'});
toast.danger  = (title, opts={}) => toast({...opts, title, variant:'danger'});
toast.info    = (title, opts={}) => toast({...opts, title, variant:'info'});

const Toaster = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { toastSetter = setItems; setItems(toastQueue); return () => toastSetter = null; }, []);
  const iconFor = { success:'ph-check-circle', warning:'ph-warning', danger:'ph-x-circle', info:'ph-info' };
  const colorFor = {
    success:'var(--color-success-text)', warning:'var(--color-warning-text)',
    danger:'var(--color-danger-text)', info:'var(--color-info-text)'
  };
  return ReactDOM.createPortal(
    <div className="fixed bottom-6 right-6 z-[600] flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id} className="pointer-events-auto w-[380px] rounded-[5px] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_8px_24px_-8px_rgba(14,14,13,0.12),0_2px_6px_rgba(14,14,13,0.06)] p-4 flex gap-3 animate-[toastIn_180ms_ease]">
          <i className={`ph ${iconFor[t.variant]||'ph-info'} flex-shrink-0`} style={{fontSize:18, color: colorFor[t.variant]}}/>
          <div className="flex-1 min-w-0">
            <div className="font-sans font-semibold text-[13px] text-[color:var(--color-n-800)]">{t.title}</div>
            {t.description && <div className="text-[12.5px] text-[color:var(--color-n-500)] leading-[1.45] mt-0.5">{t.description}</div>}
          </div>
          <button onClick={()=>{toastQueue=toastQueue.filter(x=>x.id!==t.id); toastSetter?.(toastQueue);}} className="text-[color:var(--color-n-400)] hover:text-[color:var(--color-n-700)]"><i className="ph ph-x" style={{fontSize:14}}/></button>
        </div>
      ))}
    </div>, document.body);
};

/* ─────────────── Calendar (compact) ─────────────── */
const Calendar = ({value, onChange}) => {
  const [view, setView] = useState(() => value ? new Date(value) : new Date());
  const [sel, setSel] = useState(() => value ? new Date(value) : null);
  useEffect(() => { if (value) { setSel(new Date(value)); setView(new Date(value)); } }, [value]);
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const weeks = []; let cur = 1 - first;
  for (let w=0; w<6; w++) { const row=[]; for (let d=0; d<7; d++) { row.push(cur > 0 && cur <= days ? cur : null); cur++; } weeks.push(row); }
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const wd = ['L','M','M','J','V','S','D'];
  const isToday = (d) => { const t = new Date(); return d===t.getDate() && m===t.getMonth() && y===t.getFullYear(); };
  const isSel = (d) => sel && d===sel.getDate() && m===sel.getMonth() && y===sel.getFullYear();
  return (
    <div className="rounded-[5px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 inline-block">
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>setView(new Date(y, m-1, 1))} className="w-7 h-7 rounded-[3px] hover:bg-[color:var(--accent)] flex items-center justify-center"><i className="ph ph-caret-left" style={{fontSize:13}}/></button>
        <div className="font-sans font-semibold text-[13px] text-[color:var(--color-n-800)]">{months[m]} {y}</div>
        <button onClick={()=>setView(new Date(y, m+1, 1))} className="w-7 h-7 rounded-[3px] hover:bg-[color:var(--accent)] flex items-center justify-center"><i className="ph ph-caret-right" style={{fontSize:13}}/></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {wd.map((d,i)=><div key={i} className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)] text-center py-1">{d}</div>)}
        {weeks.flat().map((d,i)=>(
          <button key={i} disabled={!d}
            onClick={()=>{ if(d){const nd=new Date(y,m,d); setSel(nd); onChange?.(nd);}}}
            className={cn('h-8 w-8 rounded-[3px] text-[12px] font-sans transition-colors',
              !d && 'invisible',
              d && !isSel(d) && 'text-[color:var(--color-n-700)] hover:bg-[color:var(--accent)]',
              isSel(d) && 'bg-[color:var(--primary)] text-white font-medium',
              isToday(d) && !isSel(d) && 'border border-[color:var(--primary)]'
            )}>{d}</button>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── Command (⌘K palette) ─────────────── */
const Command = ({open, onOpenChange, items=[]}) => {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  const filtered = items.filter(it => !it.heading && (!q || it.label.toLowerCase().includes(q.toLowerCase())));
  const grouped = []; let lastH=null;
  items.forEach(it => {
    if (it.heading) { lastH=it.heading; return; }
    if (!q || it.label.toLowerCase().includes(q.toLowerCase())) {
      grouped.push({heading:lastH, ...it});
    }
  });
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[700] flex items-start justify-center pt-[12vh]" onClick={()=>onOpenChange?.(false)}>
      <div className="absolute inset-0 bg-[rgba(14,14,13,0.35)]"/>
      <div onClick={e=>e.stopPropagation()} className="relative w-[560px] max-w-[calc(100vw-32px)] rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] shadow-[0_8px_24px_-8px_rgba(14,14,13,0.12),0_2px_6px_rgba(14,14,13,0.06)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-[color:var(--color-n-100)]">
          <i className="ph ph-magnifying-glass text-[color:var(--color-n-400)]" style={{fontSize:16}}/>
          <input autoFocus value={q} onChange={e=>{setQ(e.target.value); setIdx(0);}}
            onKeyDown={e => {
              if (e.key==='ArrowDown') { e.preventDefault(); setIdx(i=>Math.min(i+1, grouped.length-1)); }
              if (e.key==='ArrowUp')   { e.preventDefault(); setIdx(i=>Math.max(i-1, 0)); }
              if (e.key==='Enter')     { grouped[idx]?.onSelect?.(); onOpenChange?.(false); }
              if (e.key==='Escape')    { onOpenChange?.(false); }
            }}
            placeholder="Buscar paciente, protocolo, acción…"
            className="flex-1 h-12 bg-transparent border-0 outline-none text-[14px] text-[color:var(--color-n-900)] placeholder:text-[color:var(--color-n-400)]"/>
          <kbd className="font-mono text-[10.5px] text-[color:var(--color-n-500)] border border-[color:var(--color-n-200)] bg-[color:var(--color-n-25)] px-1.5 py-0.5 rounded-[3px]">esc</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto py-1">
          {grouped.length === 0 && <div className="py-10 text-center text-[13px] text-[color:var(--color-n-500)]">Sin resultados.</div>}
          {grouped.map((it, i) => {
            const showHeading = i === 0 || grouped[i-1].heading !== it.heading;
            return (
              <Fragment key={i}>
                {showHeading && it.heading && <div className="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)]">{it.heading}</div>}
                <button onClick={()=>{it.onSelect?.(); onOpenChange?.(false);}}
                  onMouseEnter={()=>setIdx(i)}
                  className={cn('w-full text-left px-4 py-2 flex items-center gap-3 text-[13px]',
                    idx === i ? 'bg-[color:var(--accent)] text-[color:var(--color-n-900)]' : 'text-[color:var(--color-n-700)]')}>
                  {it.icon && <i className={`ph ${it.icon} text-[color:var(--color-n-500)]`} style={{fontSize:15}}/>}
                  <span className="flex-1">{it.label}</span>
                  {it.shortcut && <span className="font-mono text-[10.5px] text-[color:var(--color-n-400)]">{it.shortcut}</span>}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>, document.body);
};

/* ─────────────── Separator ─────────────── */
const Separator = ({className=''}) => <div className={cn('h-px bg-[color:var(--border)]', className)}/>;

/* Export */
Object.assign(window, {
  cn, Button, Input, Textarea, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Badge, Switch, Checkbox, RadioGroup, RadioGroupItem, Select, Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  Tooltip, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  DropdownMenu, Toaster, toast, Calendar, Command, Separator
});
