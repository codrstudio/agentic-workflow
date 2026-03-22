import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/AppShell.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import SetupWizard from './pages/SetupWizard.jsx';
import Agenda from './pages/Agenda.jsx';
import Pacientes from './pages/Pacientes.jsx';
import Servicos from './pages/Servicos.jsx';
import Financeiro from './pages/Financeiro.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import Disponibilidade from './pages/Disponibilidade.jsx';
import Perfil from './pages/Perfil.jsx';
import PacientePerfil from './pages/PacientePerfil.jsx';
import PaginaClinica from './pages/PaginaClinica.jsx';
import ClinicaPublica from './pages/ClinicaPublica.jsx';
import BookingFlow from './pages/BookingFlow.jsx';
import BookingConfirmation from './pages/BookingConfirmation.jsx';
import ConfirmationPage from './pages/ConfirmationPage.jsx';
import CancelPage from './pages/CancelPage.jsx';
import ListaEspera from './pages/ListaEspera.jsx';
import HistoricoPagamentos from './pages/HistoricoPagamentos.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/booking/:token" element={<BookingConfirmation />} />
          <Route path="/public/confirm/:token" element={<ConfirmationPage />} />
          <Route path="/public/cancel/:token" element={<CancelPage />} />
          <Route path="/public/:clinic_slug" element={<ClinicaPublica />} />
          <Route path="/public/:clinic_slug/agendar" element={<BookingFlow />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute requireSetup>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/agenda" replace />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="pacientes" element={<Pacientes />} />
            <Route path="pacientes/:id" element={<PacientePerfil />} />
            <Route path="servicos" element={<Servicos />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="disponibilidade" element={<Disponibilidade />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="pagina-clinica" element={<PaginaClinica />} />
            <Route path="lista-espera" element={<ListaEspera />} />
            <Route path="historico-pagamentos" element={<HistoricoPagamentos />} />
            {/* legacy redirect */}
            <Route path="dashboard" element={<Navigate to="/agenda" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/agenda" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
