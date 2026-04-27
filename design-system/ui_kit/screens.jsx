/**
 * ui_kits/web_app/screens.jsx
 * Five core Rezeta screens — composed from shadcn primitives + Rezeta surfaces.
 */

const PATIENTS = [
  { id:1, name:'Ana María Reyes', cedula:'001-1234567-8', age:42, last:'18 abr 2026', dx:'Hipertensión esencial', status:'active' },
  { id:2, name:'José Manuel Cabrera', cedula:'402-2345678-1', age:67, last:'14 abr 2026', dx:'Cardiopatía isquémica', status:'review' },
  { id:3, name:'Ingrid Polanco Vásquez', cedula:'001-9876543-2', age:34, last:'11 abr 2026', dx:'Migraña con aura', status:'active' },
  { id:4, name:'Luis Felipe Tavárez', cedula:'031-1112223-4', age:58, last:'08 abr 2026', dx:'DM2, control', status:'active' },
  { id:5, name:'Carmen Estévez', cedula:'402-5556667-8', age:71, last:'02 abr 2026', dx:'Insuficiencia cardiaca', status:'overdue' },
];

const APPTS_TODAY = [
  { time:'9:00', name:'Ana María Reyes', kind:'Seguimiento · HTA', status:'signed' },
  { time:'9:30', name:'Luis Felipe Tavárez', kind:'Control DM2', status:'active' },
  { time:'10:15', name:'Carmen Estévez', kind:'IC NYHA III · revisión', status:'review' },
  { time:'11:00', name:'Ingrid Polanco V.', kind:'Migraña — primera consulta', status:'active' },
  { time:'12:00', name:'José M. Cabrera', kind:'Post-cateterismo', status:'active' },
];

/* ────── Dashboard ────── */
const DashboardScreen = ({onOpenPatient}) => (
  <div className="px-8 py-7 max-w-[1400px]">
    <PageHead kicker="Martes · 18 abr 2026" title="Buen día, Dr. Núñez"
      sub="Tienes 7 citas hoy en Centro Médico Real, Naco."
      actions={<>
        <Button variant="secondary"><i className="ph ph-printer" style={{fontSize:15}}/>Hoja del día</Button>
        <Button><i className="ph ph-plus" style={{fontSize:15}}/>Nueva cita</Button>
      </>}/>
    <div className="grid grid-cols-3 gap-5 mb-6">
      {[
        {k:'Citas hoy',v:'7',sub:'2 firmadas · 1 en revisión'},
        {k:'Pacientes activos',v:'248',sub:'+3 esta semana'},
        {k:'Facturado abril',v:'RD$ 184,500',sub:'12 facturas pendientes'},
      ].map(s => (
        <Card key={s.k} className="p-5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)] mb-2">{s.k}</div>
          <div className="font-serif font-medium text-[34px] tracking-[-0.015em] text-[color:var(--color-n-900)] leading-none">{s.v}</div>
          <div className="text-[12.5px] text-[color:var(--color-n-500)] mt-2">{s.sub}</div>
        </Card>
      ))}
    </div>
    <div className="grid grid-cols-[1.4fr_1fr] gap-5">
      <Card className="p-0">
        <div className="px-5 py-4 border-b border-[color:var(--color-n-100)] flex items-center justify-between">
          <div>
            <CardTitle>Agenda de hoy</CardTitle>
            <CardDescription>Centro Médico Real · Naco</CardDescription>
          </div>
          <Button variant="ghost" size="sm">Ver semana <i className="ph ph-arrow-right" style={{fontSize:13}}/></Button>
        </div>
        <div>
          {APPTS_TODAY.map((a,i) => (
            <button key={i} onClick={()=>onOpenPatient?.(1)} className="w-full text-left px-5 py-3 border-b border-[color:var(--color-n-100)] last:border-b-0 hover:bg-[color:var(--color-n-25)] flex items-center gap-4">
              <div className="font-mono text-[12px] text-[color:var(--color-n-500)] w-12 flex-shrink-0">{a.time}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13.5px] text-[color:var(--color-n-800)]">{a.name}</div>
                <div className="text-[12px] text-[color:var(--color-n-500)] mt-0.5">{a.kind}</div>
              </div>
              <Badge variant={a.status}>{a.status==='signed'?'Firmada':a.status==='active'?'Confirmada':'Revisión'}</Badge>
            </button>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-5">
        <Callout variant="warning" title="Revisión pendiente">
          El protocolo "Dolor torácico agudo" tiene 3 bloques sin revisar desde la última actualización de guías ACC/AHA.
        </Callout>
        <Card>
          <CardHeader>
            <CardTitle>Borradores</CardTitle>
            <CardDescription>3 consultas sin firmar</CardDescription>
          </CardHeader>
          <CardContent>
            {['Carmen Estévez · 14 abr','José M. Cabrera · 11 abr','Ingrid Polanco · 08 abr'].map(t=>(
              <div key={t} className="flex items-center gap-2 py-2 border-b border-[color:var(--color-n-100)] last:border-b-0 text-[13px] text-[color:var(--color-n-700)]">
                <i className="ph ph-file-text text-[color:var(--color-n-400)]" style={{fontSize:14}}/>
                <span className="flex-1">{t}</span>
                <i className="ph ph-arrow-right text-[color:var(--color-n-400)]" style={{fontSize:12}}/>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

/* ────── Pacientes ────── */
const PacientesScreen = ({onOpenPatient}) => {
  const [tab, setTab] = useState('todos');
  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <PageHead title="Pacientes" sub="248 pacientes · doctor-owned · acompañan al médico entre sedes"
        actions={<>
          <Button variant="secondary"><i className="ph ph-funnel" style={{fontSize:15}}/>Filtrar</Button>
          <Button><i className="ph ph-plus" style={{fontSize:15}}/>Registrar paciente</Button>
        </>}/>
      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList>
          <TabsTrigger value="todos" count={248}>Todos</TabsTrigger>
          <TabsTrigger value="activos" count={221}>Activos</TabsTrigger>
          <TabsTrigger value="seguimiento" count={18}>En seguimiento</TabsTrigger>
          <TabsTrigger value="archivados" count={9}>Archivados</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[420px]">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-n-400)]" style={{fontSize:15}}/>
          <Input placeholder="Buscar por nombre, cédula o RNC…" className="pl-9"/>
        </div>
        <Select options={[{value:'todas',label:'Todas las sedes'},{value:'naco',label:'CM Real · Naco'},{value:'piantini',label:'Piantini Med'}]} value="todas" onValueChange={()=>{}} className="w-[200px]"/>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Edad</TableHead>
            <TableHead>Diagnóstico principal</TableHead>
            <TableHead>Última consulta</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PATIENTS.map(p=>(
            <TableRow key={p.id} onClick={()=>onOpenPatient?.(p.id)} className="cursor-pointer">
              <TableCell name>{p.name}</TableCell>
              <TableCell mono>{p.cedula}</TableCell>
              <TableCell>{p.age} años</TableCell>
              <TableCell>{p.dx}</TableCell>
              <TableCell mono>{p.last}</TableCell>
              <TableCell><Badge variant={p.status==='active'?'active':p.status==='review'?'review':'overdue'}>{p.status==='active'?'Activo':p.status==='review'?'Revisión':'Vencido'}</Badge></TableCell>
              <TableCell><i className="ph ph-caret-right text-[color:var(--color-n-400)]" style={{fontSize:13}}/></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/* ────── Consulta (SOAP) ────── */
const ConsultaScreen = ({onSign}) => {
  const [signOpen, setSignOpen] = useState(false);
  return (
    <div className="px-8 py-7">
      <div className="flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-n-500)] mb-3.5">
        <a href="#">Pacientes</a><i className="ph ph-caret-right" style={{fontSize:11,color:'var(--color-n-300)'}}/>
        <a href="#">Ana María Reyes</a><i className="ph ph-caret-right" style={{fontSize:11,color:'var(--color-n-300)'}}/>
        <span className="text-[color:var(--color-n-700)]">Consulta del 18 abr 2026</span>
      </div>
      <PageHead kicker="Consulta · Borrador · 9:00 AM" title="Ana María Reyes"
        sub="42 años · Cédula 001-1234567-8 · HTA esencial · Última consulta 14 abr"
        actions={<>
          <Button variant="secondary">Guardar borrador</Button>
          <Button onClick={()=>setSignOpen(true)}><i className="ph ph-signature" style={{fontSize:15}}/>Firmar y publicar</Button>
        </>}/>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-4">
          <Callout variant="danger" title="Contraindicación absoluta">
            Amoxicilina registrada como alergia previa (anafilaxia, 2024). No prescribir sin evaluación especializada.
          </Callout>

          <Card>
            <CardHeader>
              <CardTitle>S — Subjetivo</CardTitle>
              <CardDescription>Motivo de consulta y síntomas referidos</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea defaultValue="Paciente refiere cefalea ocasional matutina de 2 semanas de evolución, sin náuseas ni alteraciones visuales. Adherente al tratamiento (losartán 50 mg/día). Niega disnea, palpitaciones o edema."/>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>O — Objetivo</CardTitle>
              <CardDescription>Signos vitales y exploración</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[['TA','142/88','mmHg'],['FC','76','lpm'],['SpO₂','98','%'],['Peso','68','kg']].map(([k,v,u])=>(
                  <div key={k} className="border border-[color:var(--color-n-200)] rounded-[3px] p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)] mb-1">{k}</div>
                    <div className="font-serif font-medium text-[20px] text-[color:var(--color-n-900)] leading-none">{v}<span className="font-sans text-[11px] text-[color:var(--color-n-500)] font-normal ml-1">{u}</span></div>
                  </div>
                ))}
              </div>
              <Textarea defaultValue="Cardiopulmonar sin hallazgos. Ruidos cardíacos rítmicos, sin soplos. Pulsos periféricos simétricos."/>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>A — Análisis</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="signed">HTA esencial · I10</Badge>
                <Badge variant="info">Cefalea tensional</Badge>
                <Button variant="ghost" size="sm"><i className="ph ph-plus" style={{fontSize:13}}/>Agregar diagnóstico</Button>
              </div>
              <Textarea defaultValue="HTA mal controlada. Cifras tensionales sostenidas >140/90 a pesar de monoterapia. Cefalea probablemente secundaria a HTA."/>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>P — Plan</CardTitle></CardHeader>
            <CardContent>
              <PListItem>Aumentar losartán a 100 mg c/24h</PListItem>
              <PListItem>Agregar amlodipino 5 mg c/24h por 4 semanas</PListItem>
              <PListItem>MAPA de 24h, próxima visita</PListItem>
              <PListItem critical>Revaluar si TA &gt; 160/100 o aparece dolor torácico</PListItem>
              <Button variant="outline" size="sm" className="mt-2 w-full border-dashed"><i className="ph ph-plus" style={{fontSize:13}}/>Agregar acción al plan</Button>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Protocolo aplicado</CardTitle></CardHeader>
            <CardContent>
              <Card selected className="p-3 mb-2">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[color:var(--color-n-400)] mb-1">v2.1 · firmado</div>
                <div className="font-serif font-medium text-[15px] text-[color:var(--color-n-900)]">HTA esencial — control ambulatorio</div>
              </Card>
              <Button variant="ghost" size="sm" className="w-full"><i className="ph ph-list-checks" style={{fontSize:13}}/>Ver pasos del protocolo</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Receta</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 py-2 border-b border-[color:var(--color-n-100)]">
                <i className="ph ph-pill text-[color:var(--color-n-500)]" style={{fontSize:14}}/>
                <div className="flex-1 text-[12.5px]"><b className="block text-[color:var(--color-n-800)]">Losartán 100 mg</b><span className="text-[color:var(--color-n-500)]">1 tableta c/24h · 30 días</span></div>
              </div>
              <div className="flex items-center gap-2 py-2">
                <i className="ph ph-pill text-[color:var(--color-n-500)]" style={{fontSize:14}}/>
                <div className="flex-1 text-[12.5px]"><b className="block text-[color:var(--color-n-800)]">Amlodipino 5 mg</b><span className="text-[color:var(--color-n-500)]">1 tableta c/24h · 30 días</span></div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2"><i className="ph ph-plus" style={{fontSize:13}}/>Agregar medicamento</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Próxima cita</CardTitle></CardHeader>
            <CardContent>
              <Calendar value={new Date(2026, 4, 16)}/>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center" style={{background:'var(--color-info-bg)',color:'var(--color-info-text)'}}><i className="ph ph-signature" style={{fontSize:18}}/></div>
              <div>
                <DialogTitle>Firmar y publicar consulta</DialogTitle>
                <DialogDescription>Una vez firmada, la nota clínica queda inmutable. Las correcciones se gestionan vía enmiendas.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody>
            <p className="text-[13px] text-[color:var(--color-n-600)]">Confirma que has revisado los 4 bloques SOAP, la receta (2 medicamentos) y la próxima cita propuesta para el 16 mayo 2026.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={()=>setSignOpen(false)}>Cancelar</Button>
            <Button onClick={()=>{setSignOpen(false); toast.success('Consulta firmada', {description:'Receta enviada a Ana María Reyes. Próxima cita: 16 mayo 2026, 9:00 AM.'});}}>Firmar y publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ────── Protocolo Editor — signature surface ────── */
const ProtocoloEditorScreen = () => (
  <div className="px-8 py-7">
    <div className="flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-n-500)] mb-3.5">
      <a href="#">Protocolos</a><i className="ph ph-caret-right" style={{fontSize:11,color:'var(--color-n-300)'}}/>
      <span className="text-[color:var(--color-n-700)]">Editar</span>
    </div>
    <PageHead kicker="Protocolo · v2.3 · firmado · 12 bloques · 3 checklists anidados" title="Manejo de anafilaxia en adultos"
      sub="Actualizado 14 abr 2026 · Dr. Rafael Núñez · Basado en guías ACC/AHA 2024"
      actions={<>
        <Button variant="secondary">Vista previa</Button>
        <Button variant="secondary"><i className="ph ph-clock-counter-clockwise" style={{fontSize:15}}/>Historial</Button>
        <Button>Publicar v2.4</Button>
      </>}/>

    <div className="max-w-[920px]">
      <PBlock type="alerta · crítica" title="Identificación inmediata">
        <Callout variant="danger" title="Activar protocolo si:">
          Aparición súbita de síntomas en piel/mucosas (urticaria, edema) <strong>+</strong> al menos uno: compromiso respiratorio, hipotensión, o síntomas GI severos.
        </Callout>
      </PBlock>

      <PBlock type="checklist" title="Manejo inicial — primeros 5 minutos">
        <PListItem>Posicionar al paciente en decúbito supino con piernas elevadas (Trendelenburg si shock)</PListItem>
        <PListItem critical>Adrenalina IM 0.3–0.5 mg en muslo lateral (vasto externo) — repetir cada 5–15 min PRN</PListItem>
        <PListItem>Suspender el agente desencadenante si está identificado</PListItem>
        <PListItem>Oxígeno alto flujo · monitorización continua de signos vitales</PListItem>
        <PListItem done>Llamar al equipo de emergencias / preparar vía aérea avanzada</PListItem>
      </PBlock>

      <PBlock type="tabla · dosis" title="Adrenalina — dosis por peso">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Peso</TableHead><TableHead>Dosis IM (1 mg/mL)</TableHead><TableHead>Volumen</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell name>30 – 50 kg</TableCell><TableCell mono>0.30 mg</TableCell><TableCell mono>0.30 mL</TableCell></TableRow>
            <TableRow><TableCell name>50 – 70 kg</TableCell><TableCell mono>0.40 mg</TableCell><TableCell mono>0.40 mL</TableCell></TableRow>
            <TableRow><TableCell name>&gt; 70 kg</TableCell><TableCell mono>0.50 mg</TableCell><TableCell mono>0.50 mL</TableCell></TableRow>
          </TableBody>
        </Table>
      </PBlock>

      <PBlock type="decisión" title="Si no hay respuesta tras 2 dosis IM">
        <PBlock nested type="checklist" title="Adrenalina IV · infusión continua" dragHandle={false}>
          <PListItem>Diluir 1 mg en 100 mL SSF (10 mcg/mL)</PListItem>
          <PListItem>Iniciar a 0.1 mcg/kg/min · titular cada 2–3 min</PListItem>
          <PListItem critical>Solo con monitorización cardíaca continua</PListItem>
        </PBlock>
      </PBlock>

      <button className="w-full border border-dashed border-[color:var(--color-n-200)] rounded-[5px] py-3 text-[12.5px] text-[color:var(--color-n-500)] hover:border-[color:var(--color-n-400)] hover:text-[color:var(--color-n-800)] flex items-center justify-center gap-2">
        <i className="ph ph-plus" style={{fontSize:14}}/>Agregar bloque
      </button>
    </div>
  </div>
);

/* ────── Agenda ────── */
const AgendaScreen = () => (
  <div className="px-8 py-7 max-w-[1400px]">
    <PageHead kicker="Semana 16 · 13 – 19 abr" title="Agenda"
      actions={<>
        <Button variant="secondary"><i className="ph ph-caret-left" style={{fontSize:14}}/></Button>
        <Button variant="secondary">Hoy</Button>
        <Button variant="secondary"><i className="ph ph-caret-right" style={{fontSize:14}}/></Button>
        <div className="w-px h-6 bg-[color:var(--color-n-200)] mx-1"/>
        <Button><i className="ph ph-plus" style={{fontSize:15}}/>Nueva cita</Button>
      </>}/>
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[color:var(--color-n-200)]">
        <div></div>
        {['Lun 13','Mar 14','Mié 15','Jue 16','Vie 17','Sáb 18','Dom 19'].map((d,i)=>(
          <div key={d} className={cn('px-3 py-3 border-l border-[color:var(--color-n-100)] font-sans font-medium text-[12.5px]',
            i===5 ? 'text-[color:var(--color-n-900)] bg-[color:var(--color-n-25)]' : 'text-[color:var(--color-n-600)]')}>
            {d}
            {i===5 && <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--primary)] mt-0.5">Hoy</div>}
          </div>
        ))}
      </div>
      {['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map((t,r)=>(
        <div key={t} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[color:var(--color-n-100)] last:border-b-0 min-h-[60px]">
          <div className="px-3 py-2 font-mono text-[11px] text-[color:var(--color-n-400)]">{t}</div>
          {[0,1,2,3,4,5,6].map(c=>(
            <div key={c} className={cn('border-l border-[color:var(--color-n-100)] p-1.5 relative',
              c===5 && 'bg-[color:var(--color-n-25)]')}>
              {c===5 && r===1 && <div className="bg-[color:var(--color-p-50)] border border-[color:var(--color-p-100)] rounded-[3px] p-2 relative">
                <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-[color:var(--primary)]"/>
                <div className="text-[11.5px] font-semibold text-[color:var(--color-p-700)]">9:00 — Ana María Reyes</div>
                <div className="text-[11px] text-[color:var(--color-n-500)] mt-0.5">Seguimiento HTA</div>
              </div>}
              {c===5 && r===2 && <div className="bg-[color:var(--color-warning-bg)] border border-[color:var(--color-warning-border)] rounded-[3px] p-2"><div className="text-[11.5px] font-semibold text-[color:var(--color-warning-text)]">10:15 — Carmen Estévez</div><div className="text-[11px] text-[color:var(--color-warning-text)] opacity-75 mt-0.5">IC NYHA III · revisión</div></div>}
              {c===2 && r===1 && <div className="bg-[color:var(--card)] border border-[color:var(--color-n-200)] rounded-[3px] p-2"><div className="text-[11.5px] font-semibold text-[color:var(--color-n-800)]">9:00 — Luis Tavárez</div><div className="text-[11px] text-[color:var(--color-n-500)] mt-0.5">Control DM2</div></div>}
              {c===4 && r===4 && <div className="bg-[color:var(--card)] border border-[color:var(--color-n-200)] rounded-[3px] p-2"><div className="text-[11.5px] font-semibold text-[color:var(--color-n-800)]">12:00 — J.M. Cabrera</div><div className="text-[11px] text-[color:var(--color-n-500)] mt-0.5">Post-cateterismo</div></div>}
            </div>
          ))}
        </div>
      ))}
    </Card>
  </div>
);

Object.assign(window, { DashboardScreen, PacientesScreen, ConsultaScreen, ProtocoloEditorScreen, AgendaScreen });
