/** ui_kits/web_app/app.jsx — final mount */
const { useState } = React;

function RezetaApp() {
  const [route, setRoute] = useState('dashboard');
  const onOpenPatient = () => setRoute('consulta');

  const screen = (() => {
    switch(route) {
      case 'dashboard':   return <DashboardScreen onOpenPatient={onOpenPatient}/>;
      case 'agenda':      return <AgendaScreen/>;
      case 'pacientes':   return <PacientesScreen onOpenPatient={onOpenPatient}/>;
      case 'protocolos':  return <ProtocoloEditorScreen/>;
      case 'consulta':    return <ConsultaScreen/>;
      default:
        return (
          <div className="px-8 py-7">
            <PageHead title="Pendiente"
              sub="Esta vista no se incluye en el UI kit demo. Vuelve a Dashboard, Pacientes o Protocolos."/>
          </div>
        );
    }
  })();

  const navHighlight = route === 'consulta' ? 'pacientes' : route;

  return (
    <>
      <div className="flex min-h-screen" data-screen-label={`Rezeta · ${route}`}>
        <Sidebar active={navHighlight} onNav={setRoute}/>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar/>
          <main className="flex-1 min-w-0">{screen}</main>
        </div>
      </div>
      <Toaster/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<RezetaApp/>);
