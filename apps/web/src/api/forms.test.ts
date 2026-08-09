import { describe, expect, it, vi } from 'vitest';
import {
  activateFormIndicator,
  activateFormTemplate,
  activateFormTopic,
  createFormIndicator,
  createFormTemplate,
  createFormTopic,
  deactivateFormIndicator,
  deactivateFormTemplate,
  deactivateFormTopic,
  distributeIndicatorScores,
  getFormTemplate,
  getIndicatorScores,
  listFormTemplates,
  updateFormIndicator,
  updateFormTemplate,
  updateFormTopic,
  updateIndicatorScores,
} from './forms';
import { apiGet, apiSend } from '../lib/api-client';

vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client');
  return { ...actual, apiGet: vi.fn(), apiSend: vi.fn() };
});

describe('forms api', () => {
  it('listFormTemplates defaults includeInactive to false', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([] as never);
    await listFormTemplates();
    expect(apiGet).toHaveBeenCalledWith('/form-templates?includeInactive=false');
  });

  it('getFormTemplate includes includeInactive when true', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({} as never);
    await getFormTemplate('template-1', true);
    expect(apiGet).toHaveBeenCalledWith('/form-templates/template-1?includeInactive=true');
  });

  it('createFormTemplate posts the payload', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await createFormTemplate({ name: 'Formulário Mensal' });
    expect(apiSend).toHaveBeenCalledWith('POST', '/form-templates', { name: 'Formulário Mensal' });
  });

  it('updateFormTemplate patches by id', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await updateFormTemplate('template-1', { name: 'Novo nome' });
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-templates/template-1', { name: 'Novo nome' });
  });

  it('deactivateFormTemplate and activateFormTemplate hit their actions', async () => {
    vi.mocked(apiSend).mockResolvedValue({} as never);
    await deactivateFormTemplate('template-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-templates/template-1/deactivate');
    await activateFormTemplate('template-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-templates/template-1/activate');
  });

  it('createFormTopic posts to the template topics endpoint', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await createFormTopic('template-1', { title: 'Infraestrutura' });
    expect(apiSend).toHaveBeenCalledWith('POST', '/form-templates/template-1/topics', { title: 'Infraestrutura' });
  });

  it('updateFormTopic, deactivateFormTopic and activateFormTopic target the topic by id', async () => {
    vi.mocked(apiSend).mockResolvedValue({} as never);
    await updateFormTopic('topic-1', { title: 'Novo título' });
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-topics/topic-1', { title: 'Novo título' });
    await deactivateFormTopic('topic-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-topics/topic-1/deactivate');
    await activateFormTopic('topic-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-topics/topic-1/activate');
  });

  it('createFormIndicator posts to the topic indicators endpoint', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    const input = {
      title: 'Disponibilidade',
      objective: 'Medir uptime',
      variableKeys: ['uptime', 'total'],
      formulaExpression: '(uptime / total) * 100',
      goalOperator: 'GTE' as const,
      goalValue: 99,
      catalogEntryId: 'catalog-1',
    };
    await createFormIndicator('topic-1', input);
    expect(apiSend).toHaveBeenCalledWith('POST', '/form-topics/topic-1/indicators', input);
  });

  it('updateFormIndicator, deactivateFormIndicator and activateFormIndicator target the indicator by id', async () => {
    vi.mocked(apiSend).mockResolvedValue({} as never);
    await updateFormIndicator('indicator-1', { title: 'Novo título' });
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-indicators/indicator-1', { title: 'Novo título' });
    await deactivateFormIndicator('indicator-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-indicators/indicator-1/deactivate');
    await activateFormIndicator('indicator-1');
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-indicators/indicator-1/activate');
  });

  it('getIndicatorScores fetches the score summary for a template', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({} as never);
    await getIndicatorScores('template-1');
    expect(apiGet).toHaveBeenCalledWith('/form-templates/template-1/indicator-scores');
  });

  it('updateIndicatorScores patches the weights for a template', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    const weights = [{ indicatorId: 'indicator-1', scoreWeight: 10 }];
    await updateIndicatorScores('template-1', weights);
    expect(apiSend).toHaveBeenCalledWith('PATCH', '/form-templates/template-1/indicator-scores', { weights });
  });

  it('distributeIndicatorScores posts to the distribute endpoint', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await distributeIndicatorScores('template-1');
    expect(apiSend).toHaveBeenCalledWith('POST', '/form-templates/template-1/indicator-scores/distribute');
  });
});
