import { apiGet, apiSend, buildQueryString } from '../lib/api-client';
import type {
  FormIndicator,
  FormTemplate,
  FormTopic,
  GoalOperator,
  IndicatorMutationResult,
  IndicatorScoreSummary,
} from '../types/api';

export interface FormTemplateInput {
  name: string;
  description?: string;
}

export interface FormTopicInput {
  title: string;
  order?: number;
}

export interface FormIndicatorInput {
  title: string;
  objective: string;
  variableKeys: string[];
  formulaExpression: string;
  goalOperator: GoalOperator;
  goalValue: number;
  // Vinculo obrigatorio ao catalogo canonico (FR-062).
  catalogEntryId: string;
  isResidentState?: boolean;
  order?: number;
}

export function listFormTemplates(includeInactive = false): Promise<FormTemplate[]> {
  return apiGet<FormTemplate[]>(`/form-templates${buildQueryString({ includeInactive })}`);
}

export function getFormTemplate(id: string, includeInactive = false): Promise<FormTemplate> {
  return apiGet<FormTemplate>(`/form-templates/${encodeURIComponent(id)}${buildQueryString({ includeInactive })}`);
}

export function createFormTemplate(input: FormTemplateInput): Promise<FormTemplate> {
  return apiSend<FormTemplate>('POST', '/form-templates', input);
}

export function updateFormTemplate(id: string, input: Partial<FormTemplateInput>): Promise<FormTemplate> {
  return apiSend<FormTemplate>('PATCH', `/form-templates/${encodeURIComponent(id)}`, input);
}

export function deactivateFormTemplate(id: string): Promise<FormTemplate> {
  return apiSend<FormTemplate>('PATCH', `/form-templates/${encodeURIComponent(id)}/deactivate`);
}

export function activateFormTemplate(id: string): Promise<FormTemplate> {
  return apiSend<FormTemplate>('PATCH', `/form-templates/${encodeURIComponent(id)}/activate`);
}

export function createFormTopic(templateId: string, input: FormTopicInput): Promise<FormTopic> {
  return apiSend<FormTopic>('POST', `/form-templates/${encodeURIComponent(templateId)}/topics`, input);
}

export function updateFormTopic(id: string, input: Partial<FormTopicInput>): Promise<FormTopic> {
  return apiSend<FormTopic>('PATCH', `/form-topics/${encodeURIComponent(id)}`, input);
}

export function deactivateFormTopic(id: string): Promise<FormTopic> {
  return apiSend<FormTopic>('PATCH', `/form-topics/${encodeURIComponent(id)}/deactivate`);
}

export function activateFormTopic(id: string): Promise<FormTopic> {
  return apiSend<FormTopic>('PATCH', `/form-topics/${encodeURIComponent(id)}/activate`);
}

export function createFormIndicator(topicId: string, input: FormIndicatorInput): Promise<IndicatorMutationResult> {
  return apiSend<IndicatorMutationResult>('POST', `/form-topics/${encodeURIComponent(topicId)}/indicators`, input);
}

export function updateFormIndicator(id: string, input: Partial<FormIndicatorInput>): Promise<FormIndicator> {
  return apiSend<FormIndicator>('PATCH', `/form-indicators/${encodeURIComponent(id)}`, input);
}

export function deactivateFormIndicator(id: string): Promise<IndicatorMutationResult> {
  return apiSend<IndicatorMutationResult>('PATCH', `/form-indicators/${encodeURIComponent(id)}/deactivate`);
}

export function activateFormIndicator(id: string): Promise<IndicatorMutationResult> {
  return apiSend<IndicatorMutationResult>('PATCH', `/form-indicators/${encodeURIComponent(id)}/activate`);
}

export function getIndicatorScores(templateId: string): Promise<IndicatorScoreSummary> {
  return apiGet<IndicatorScoreSummary>(`/form-templates/${encodeURIComponent(templateId)}/indicator-scores`);
}

export function updateIndicatorScores(
  templateId: string,
  weights: Array<{ indicatorId: string; scoreWeight: number }>,
): Promise<IndicatorScoreSummary> {
  return apiSend<IndicatorScoreSummary>(
    'PATCH',
    `/form-templates/${encodeURIComponent(templateId)}/indicator-scores`,
    { weights },
  );
}

export function distributeIndicatorScores(templateId: string): Promise<IndicatorScoreSummary> {
  return apiSend<IndicatorScoreSummary>(
    'POST',
    `/form-templates/${encodeURIComponent(templateId)}/indicator-scores/distribute`,
  );
}
