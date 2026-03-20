import { useAuth } from '../context/AuthContext.jsx';
import NotificationStats from '../components/NotificationStats.jsx';

export default function Dashboard() {
  const { therapist, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Agenda Fisio</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {therapist?.name || therapist?.email}
          </span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Bem-vindo!</h2>
          <p className="text-gray-500 text-sm">
            Olá, <strong>{therapist?.name}</strong>. Sua agenda está sendo preparada.
          </p>
          <p className="text-gray-400 text-xs mt-4">
            Funcionalidades sendo implementadas nas próximas features.
          </p>
        </div>
        <div className="col-span-1">
          <NotificationStats />
        </div>
      </main>
    </div>
  );
}
