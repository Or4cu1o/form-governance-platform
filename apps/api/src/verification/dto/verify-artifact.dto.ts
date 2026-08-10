import { IsString, Matches } from 'class-validator';

// O arquivo NAO e enviado (evita a plataforma receber conteudo nao
// solicitado) — o auditor calcula o digest localmente e so ele trafega.
export class VerifyArtifactDto {
  @IsString()
  @Matches(/^[0-9a-f]{64}$/i, { message: 'artifactDigest deve ser um SHA-256 em hexadecimal' })
  artifactDigest!: string;
}
