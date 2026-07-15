import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Activate from './pages/Activate';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/Users';
import AdminTurmas from './pages/admin/Turmas';
import TurmaDetalhe from './pages/admin/TurmaDetalhe';
import CursoDetalhe from './pages/admin/CursoDetalhe';
import AdminCursos from './pages/admin/Cursos';
import AdminAulas from './pages/admin/Aulas';
import StudentDashboard from './pages/student/Dashboard';
import StudentCourse from './pages/student/Course';
import StudentCommunity from './pages/student/Community';
import Comunidade from './pages/student/Comunidade';
import AtividadesIndex from './pages/student/AtividadesIndex';
import AtividadesLista from './pages/student/AtividadesLista';
import AtividadeDetalhe from './pages/student/AtividadeDetalhe';

function Loading() {
  return <div className="min-h-screen grid place-items-center"><p className="meta">Carregando...</p></div>;
}

function RequireAuth({ roles }: { roles?: Array<'admin' | 'student' | 'professor' | 'monitor'> }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (profile.status === 'blocked') return <Blocked />;
  if (profile.status === 'pending') return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <Outlet />;
}

function Blocked() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-3">Conta bloqueada</h1>
        <p className="text-[#d6deed] mb-6">Sua conta foi bloqueada. Entre em contato com o administrador.</p>
        <button onClick={() => signOut()} className="text-[#cbfb00] hover:underline text-sm">Sair</button>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || !profile) return <Landing />;
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (session && profile) return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/ativar" element={<Activate />} />
          <Route path="/recuperar-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />

          <Route element={<RequireAuth roles={["admin"]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/usuarios" element={<AdminUsers />} />
              <Route path="/admin/turmas" element={<AdminTurmas />} />
              <Route path="/admin/turmas/:turmaId" element={<TurmaDetalhe />} />
              <Route path="/admin/turmas/:turmaId/cursos/:cursoId" element={<CursoDetalhe />} />
              <Route path="/admin/cursos" element={<AdminCursos />} />
              <Route path="/admin/aulas" element={<AdminAulas />} />
            </Route>
          </Route>

          <Route element={<RequireAuth roles={["student", "professor", "monitor"]} />}>
            <Route element={<StudentLayout />}>
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/curso/:id" element={<StudentCourse />} />
              <Route path="/comunidade" element={<Comunidade />} />
              <Route path="/turma/:turmaId/comunidade" element={<StudentCommunity />} />
              <Route path="/atividades" element={<AtividadesIndex />} />
              <Route path="/atividades/:turmaId/:cursoId" element={<AtividadesLista />} />
              <Route path="/atividade/:atividadeId" element={<AtividadeDetalhe />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
