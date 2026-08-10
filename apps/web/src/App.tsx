import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminAccessPage } from './pages/AdminAccessPage';
import { AdminCatalogPage } from './pages/AdminCatalogPage';
import { AdminFormsPage } from './pages/AdminFormsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { ValidationBoardPage } from './pages/ValidationBoardPage';
import { ValidationDetailPage } from './pages/ValidationDetailPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/auditoria" element={<AuditPage />} />

              <Route element={<ProtectedRoute allowedRoles={['ELABORADOR', 'REVISOR', 'ADMINISTRADOR']} />}>
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="/relatorios/:id" element={<ReportDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['APROVADOR', 'ADMINISTRADOR']} />}>
                <Route path="/validacao" element={<ValidationBoardPage />} />
                <Route path="/validacao/:id" element={<ValidationDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR']} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="acessos" replace />} />
                  <Route path="acessos" element={<AdminAccessPage />} />
                  <Route path="formularios" element={<AdminFormsPage />} />
                  <Route path="catalogo" element={<AdminCatalogPage />} />
                  <Route path="configuracoes" element={<AdminSettingsPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
