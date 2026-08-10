import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from './render-with-providers';
import { AuditPage } from '../pages/AuditPage';
import { VerifyPage } from '../pages/VerifyPage';
import { EvidenceExpiredPage } from '../pages/EvidenceExpiredPage';
import { AdminCatalogPage } from '../pages/AdminCatalogPage';
import { AbsenceLegend } from '../components/AbsenceLegend';
import { SparseMatrix } from '../components/SparseMatrix';
import { StatusBadge } from '../components/ui';
import * as auditApi from '../api/audit';
import * as verificationApi from '../api/verification';
import * as catalogApi from '../api/catalog';
import type { AuditQueryResult } from '../api/audit';
import type { VerificationEnvelope } from '../api/verification';
import type { CatalogEntry } from '../types/api';

vi.mock('../api/audit');
vi.mock('../api/verification');
vi.mock('../api/catalog');

// T157a (FR-125, constituição §Identidade e idioma) — nenhum estado desta
// plataforma é comunicado só por cor. Cada bloco abaixo prova que a
// superfície carrega, além do tom visual, um rótulo textual acessível
// (visível na tela ou via aria-label/aria-hidden corretamente combinados —
// nunca só `title=`, que não é confiável em leitor de tela nem em touch).
describe('Estados nunca são só cor — rótulo textual acessível (T157a)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AbsenceLegend', () => {
    it('cada código de ausência tem descrição textual visível ao lado, nunca só o código colorido', () => {
      render(<AbsenceLegend legend={{ NA_FORA_DO_NIVEL: 'Fora do nível — a unidade não tinha este indicador.' }} />);

      expect(screen.getByText('NA_FORA_DO_NIVEL')).toBeInTheDocument();
      expect(screen.getByText('Fora do nível — a unidade não tinha este indicador.')).toBeInTheDocument();
    });
  });

  describe('SparseMatrix', () => {
    const columns = [{ indicatorCode: 'IND-01', measurementUnit: 'unidades' }];

    it('toda célula de ausência mostra o rótulo textual do código, nunca uma célula muda', () => {
      render(
        <SparseMatrix
          columns={columns}
          rows={[{ unitId: 'unit-A', referencePeriod: '2026-06', cells: {} }]}
          aggregations={[]}
          columnOrder={[]}
          hiddenColumns={[]}
          onMoveColumn={() => {}}
          onToggleColumnVisibility={() => {}}
        />,
      );

      // Sem entrada em `cells` para IND-01 -> célula "—" textual, nunca vazia/omitida.
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('o marcador de outlier carrega aria-label, não depende só da cor/tooltip (regressão desta tarefa)', () => {
      render(
        <SparseMatrix
          columns={columns}
          rows={[
            {
              unitId: 'unit-A',
              referencePeriod: '2026-06',
              cells: { 'IND-01': { kind: 'VALOR', value: 999, isOutlier: true } },
            },
          ]}
          aggregations={[]}
          columnOrder={[]}
          hiddenColumns={[]}
          onMoveColumn={() => {}}
          onToggleColumnVisibility={() => {}}
        />,
      );

      expect(screen.getByLabelText(/Sinalizado como atípico/)).toBeInTheDocument();
    });
  });

  describe('StatusBadge (usado por AdminCatalogPage)', () => {
    it('sempre combina o ponto colorido (aria-hidden) com um texto visível — nunca só a cor', () => {
      render(<StatusBadge tone="concluido" label="Ativo" />);

      const dot = document.querySelector('[aria-hidden="true"]');
      expect(dot).not.toBeNull();
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });
  });

  describe('AdminCatalogPage', () => {
    const entry: CatalogEntry = {
      id: 'catalog-1',
      code: 'DISP-01',
      name: 'Disponibilidade',
      description: null,
      measurementUnit: '%',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('mostra "Ativo"/"Inativo" por extenso ao lado do indicador colorido de cada entrada do catálogo', async () => {
      vi.mocked(catalogApi.searchCatalog).mockResolvedValue([entry, { ...entry, id: 'catalog-2', code: 'DISP-02', isActive: false }]);

      renderWithProviders(<AdminCatalogPage />);

      expect(await screen.findByText('Ativo')).toBeInTheDocument();
      expect(screen.getByText('Inativo')).toBeInTheDocument();
    });
  });

  describe('AuditPage', () => {
    const baseResult: AuditQueryResult = {
      columns: [{ indicatorCode: 'IND-01', measurementUnit: 'unidades' }],
      rows: [{ unitId: 'unit-A', referencePeriod: '2026-06', cells: { 'IND-01': { kind: 'VALOR', value: 10, isOutlier: false } } }],
      aggregations: [],
      absenceLegend: { NA_FORA_DO_NIVEL: 'Fora do nível.' },
      isEmptyResult: false,
      nextCursor: null,
      countMode: 'EXATA',
      count: 1,
      outlierRule: 'IQR',
    };

    function mockDefaults(overrides: Partial<AuditQueryResult> = {}) {
      vi.mocked(auditApi.queryAudit).mockResolvedValue({ ...baseResult, ...overrides });
      vi.mocked(auditApi.getAuditFilters).mockResolvedValue({ units: [], levels: ['A', 'B', 'C'], indicatorCodes: [] });
      vi.mocked(auditApi.getTablePreference).mockResolvedValue({ columnOrder: [], hiddenColumns: [] });
    }

    it('conjunto vazio é comunicado com texto explícito, nunca apenas por uma cor/estado visual de tabela', async () => {
      mockDefaults({ isEmptyResult: true, rows: [], count: 0 });

      renderWithProviders(<AuditPage />);

      expect(await screen.findByText(/conjunto está vazio/i)).toBeInTheDocument();
    });
  });

  describe('VerifyPage', () => {
    function renderAt(codigo: string) {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/verificar/${codigo}`]}>
            <Routes>
              <Route path="/verificar/:codigo" element={<VerifyPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    }

    function envelope(overrides: Partial<VerificationEnvelope> = {}): VerificationEnvelope {
      return {
        verdict: 'INTEGRO',
        issuedAt: '2026-08-07T13:45:12.000Z',
        unitAcronym: 'TI',
        referencePeriod: '2026-06',
        reportStatus: 'CONCLUIDO',
        approver: { name: 'Ana Aprovadora', jobTitle: 'Chefe de Gabinete' },
        artifactKind: 'RELATORIO',
        artifactFormat: 'PDF',
        contentDigest: 'content-digest-abc',
        artifactDigest: 'artifact-digest-abc',
        signature: 'sig-abc',
        keyId: 'seal-2026-01',
        sealContractVersion: 'seal-v1',
        revocation: null,
        ...overrides,
      };
    }

    // Cada veredito tem tom de cor (TONE_CLASSES) — este teste prova que
    // TODOS os cinco tambem carregam um rotulo textual visivel emparelhado.
    it.each([
      ['INTEGRO', 'Íntegro'],
      ['CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO', 'Conteúdo íntegro — arquivo adulterado'],
      ['CONTEUDO_DIVERGENTE', 'Conteúdo divergente'],
      ['REVOGADO', 'Selo revogado'],
      ['NAO_ENCONTRADO', 'Código não encontrado'],
    ] as const)('veredito %s mostra o rótulo textual "%s", não apenas a cor do painel', async (verdict, label) => {
      vi.mocked(verificationApi.getSeal).mockResolvedValue(envelope({ verdict }));

      renderAt('codigo-teste');

      expect(await screen.findByText(label)).toBeInTheDocument();
    });
  });

  describe('EvidenceExpiredPage', () => {
    it('mostra uma mensagem textual, não apenas uma cor de estado', () => {
      render(<EvidenceExpiredPage />);

      expect(screen.getByText('Vínculo de evidência expirado')).toBeInTheDocument();
    });
  });
});
