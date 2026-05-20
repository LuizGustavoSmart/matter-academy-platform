import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

export default function StudentLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const logout = async () => { await signOut(); nav('/login'); };

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#1c1f26] sticky top-0 bg-black/80 backdrop-blur-md z-40">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          <Link to="/dashboard"><Logo height={80} /></Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#d6deed] hidden sm:inline">{profile?.email}</span>
            <button onClick={logout} className="flex items-center gap-2 text-sm text-[#d6deed] hover:text-[#cbfb00] transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
