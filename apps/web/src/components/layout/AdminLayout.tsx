import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';

const ADMIN_TABS = [
  { to: '/admin/acessos', label: 'Acessos' },
  { to: '/admin/formularios', label: 'Formulários' },
  { to: '/admin/catalogo', label: 'Catálogo' },
  { to: '/admin/configuracoes', label: 'Configurações' },
];

export function AdminLayout() {
  return (
    <>
      <div className="bg-paper-raised px-8 pt-4">
        <div className="flex gap-1 border-b border-border">
          {ADMIN_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-out-expo',
                  isActive ? 'border-accent text-ink' : 'border-transparent text-ink-faint hover:text-ink-muted',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </>
  );
}
