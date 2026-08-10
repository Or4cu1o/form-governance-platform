import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getSeal, verifyArtifact } from '../api/verification';
import type { VerificationEnvelope, VerificationVerdict } from '../api/verification';
import { Button, Input, Spinner } from '../components/ui';
import { brand } from '../config/brand';

const VERDICT_COPY: Record<VerificationVerdict, { label: string; description: string; tone: 'ok' | 'warn' | 'bad' }> = {
  INTEGRO: {
    label: 'Íntegro',
    description: 'O conteúdo e o arquivo conferem exatamente com o que foi emitido pela plataforma.',
    tone: 'ok',
  },
  CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO: {
    label: 'Conteúdo íntegro — arquivo adulterado',
    description:
      'O dado por trás deste selo é o mesmo que foi emitido, mas o arquivo em suas mãos não confere com o arquivo original. Ele foi editado depois da emissão.',
    tone: 'bad',
  },
  CONTEUDO_DIVERGENTE: {
    label: 'Conteúdo divergente',
    description: 'Este código não corresponde a nenhum conteúdo íntegro emitido pela plataforma.',
    tone: 'bad',
  },
  REVOGADO: {
    label: 'Selo revogado',
    description: 'Este selo foi revogado após a emissão. O registro original permanece consultável e não foi alterado.',
    tone: 'warn',
  },
  NAO_ENCONTRADO: {
    label: 'Código não encontrado',
    description: 'Não existe nenhum selo correspondente a este código.',
    tone: 'bad',
  },
};

const TONE_CLASSES: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'border-status-concluido/30 bg-status-concluido/10 text-status-concluido',
  warn: 'border-status-aprovacao/30 bg-status-aprovacao/10 text-status-aprovacao',
  bad: 'border-status-reprovado/30 bg-status-reprovado/10 text-status-reprovado',
};

function DigestRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      <span className="break-all font-mono text-xs text-ink-muted">{value}</span>
    </div>
  );
}

function VerdictPanel({ envelope }: { envelope: VerificationEnvelope }) {
  const copy = VERDICT_COPY[envelope.verdict];
  return (
    <>
      <div className={`rounded-lg border-2 px-6 py-5 ${TONE_CLASSES[copy.tone]}`}>
        <p className="text-lg font-semibold">{copy.label}</p>
        <p className="mt-1 text-sm">{copy.description}</p>
        {envelope.revocation && (
          <p className="mt-2 text-sm">
            Motivo: {envelope.revocation.reason} — revogado em {new Date(envelope.revocation.revokedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {envelope.verdict !== 'NAO_ENCONTRADO' && (
        <div className="grid gap-4 rounded-lg border border-border bg-paper-raised p-6 sm:grid-cols-2">
          {envelope.unitAcronym && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Unidade</span>
              <p className="text-sm text-ink">{envelope.unitAcronym}</p>
            </div>
          )}
          {envelope.referencePeriod && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Período</span>
              <p className="text-sm text-ink">{envelope.referencePeriod}</p>
            </div>
          )}
          {envelope.reportStatus && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Status</span>
              <p className="text-sm text-ink">{envelope.reportStatus}</p>
            </div>
          )}
          {envelope.approver.name && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Assinatura eletrônica</span>
              <p className="text-sm text-ink">
                {envelope.approver.name}
                {envelope.approver.jobTitle ? ` — ${envelope.approver.jobTitle}` : ''}
              </p>
            </div>
          )}
          {envelope.issuedAt && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Emitido em</span>
              <p className="text-sm text-ink">{new Date(envelope.issuedAt).toLocaleString('pt-BR')}</p>
            </div>
          )}
        </div>
      )}

      {envelope.verdict !== 'NAO_ENCONTRADO' && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-paper-sunken p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Prova criptográfica — para conferência offline com a chave pública publicada
          </p>
          <DigestRow label="Content Digest (SHA-256)" value={envelope.contentDigest} />
          <DigestRow label="Artifact Digest (SHA-256)" value={envelope.artifactDigest} />
          <DigestRow label="Assinatura (Ed25519, base64)" value={envelope.signature} />
          <DigestRow label="Chave de selagem" value={envelope.keyId} />
          <DigestRow label="Versão do contrato" value={envelope.sealContractVersion} />
        </div>
      )}
    </>
  );
}

export function VerifyPage() {
  const { codigo = '' } = useParams<{ codigo: string }>();
  const [artifactDigestInput, setArtifactDigestInput] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-seal', codigo],
    queryFn: () => getSeal(codigo),
    enabled: Boolean(codigo),
  });

  const verifyArtifactMutation = useMutation({
    mutationFn: (artifactDigest: string) => verifyArtifact(codigo, artifactDigest),
  });

  function handleVerifyArtifact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (artifactDigestInput.trim()) {
      verifyArtifactMutation.mutate(artifactDigestInput.trim());
    }
  }

  const envelope = verifyArtifactMutation.data ?? data;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Verificação pública de selo</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{brand.departmentAcronym}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Confira a autenticidade de um documento emitido pela plataforma. Esta página não exige login.
        </p>
      </header>

      <p className="rounded border border-border bg-paper-sunken px-4 py-2 text-center font-mono text-sm text-ink">{codigo}</p>

      {isLoading && <Spinner label="Consultando o selo..." />}
      {isError && (
        <div className="rounded-lg border-2 border-status-reprovado/30 bg-status-reprovado/10 px-6 py-5 text-status-reprovado">
          Não foi possível consultar este código agora. Tente novamente em instantes.
        </div>
      )}

      {!isLoading && !isError && envelope && <VerdictPanel envelope={envelope} />}

      {!isLoading && !isError && data && data.verdict !== 'NAO_ENCONTRADO' && (
        <form onSubmit={handleVerifyArtifact} className="flex flex-col gap-3 rounded-lg border border-border bg-paper-raised p-6">
          <label htmlFor="artifactDigest" className="text-sm font-medium text-ink">
            Tem o arquivo em mãos? Confira se ele não foi adulterado.
          </label>
          <p className="text-xs text-ink-muted">
            Calcule o SHA-256 do arquivo que você recebeu e cole abaixo — o arquivo em si nunca é enviado à plataforma.
          </p>
          <Input
            id="artifactDigest"
            placeholder="SHA-256 do arquivo (64 caracteres hexadecimais)"
            value={artifactDigestInput}
            onChange={(event) => setArtifactDigestInput(event.target.value)}
          />
          <Button type="submit" isLoading={verifyArtifactMutation.isPending}>
            Verificar arquivo
          </Button>
        </form>
      )}
    </div>
  );
}
