import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, LayoutDashboard, LogOut, SearchCheck, ShieldCheck, Sliders } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL } from '../../lib/status';
import { cn } from '../../lib/cn';
import { brand } from '../../config/brand';
import type { RoleName } from '../../types/api';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: RoleName[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Painel Central',
    icon: LayoutDashboard,
    roles: ['OBSERVADOR', 'ELABORADOR', 'REVISOR', 'APROVADOR', 'ADMINISTRADOR'],
  },
  {
    to: '/auditoria',
    label: 'Área de Auditoria',
    icon: SearchCheck,
    roles: ['OBSERVADOR', 'ELABORADOR', 'REVISOR', 'APROVADOR', 'ADMINISTRADOR'],
  },
  {
    to: '/relatorios',
    label: 'Elaboração e Revisão',
    icon: ClipboardList,
    roles: ['ELABORADOR', 'REVISOR', 'ADMINISTRADOR'],
  },
  {
    to: '/validacao',
    label: 'Mesa de Validação',
    icon: ShieldCheck,
    roles: ['APROVADOR', 'ADMINISTRADOR'],
  },
  {
    to: '/admin',
    label: 'Administração',
    icon: Sliders,
    roles: ['ADMINISTRADOR'],
  },
];

function initialsOf(nome: string, sobrenome: string): string {
  return `${nome.charAt(0)}${sobrenome.charAt(0)}`.toUpperCase();
}

export function AppShell() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex w-72 shrink-0 flex-col overflow-y-auto bg-console text-white">
        <div className="flex items-center gap-3 border-b border-console-border px-6 py-6">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent text-sm font-bold tracking-tight text-accent-ink"
            aria-hidden="true"
          >
            {user.primaryUnit?.sigla ? user.primaryUnit.sigla.charAt(0) : brand.departmentAcronym.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-wide text-white">
              {user.primaryUnit?.sigla ?? brand.departmentAcronym}
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-white/50">
              {user.primaryUnit?.nome ?? brand.departmentFullName}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-5" aria-label="Navegação principal">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-sm border-l-2 py-2.5 pl-4 pr-3 text-sm font-medium',
                  'transition-[color,background-color,border-color] duration-normal ease-out-expo',
                  isActive
                    ? 'border-accent-300 bg-white/[0.07] text-white'
                    : 'border-transparent text-white/60 hover:border-white/20 hover:bg-white/[0.04] hover:text-white/90',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-console-border px-3 py-4">
          <div className="mb-1 flex items-center gap-3 rounded-sm px-3 py-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-900 text-xs font-semibold text-accent-200"
              aria-hidden="true"
            >
              {initialsOf(user.nome, user.sobrenome)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user.nome} {user.sobrenome}
              </p>
              <p className="truncate text-xs text-white/50">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-white/60 transition-colors duration-normal ease-out-expo hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] flex-1">
          <Outlet />
        </div>
        <footer className="border-t border-border bg-paper-raised px-8 py-4 text-center text-xs text-ink-faint">
          {brand.copyrightLine}
        </footer>
      </main>
    </div>
  );
}
