export const frontierModels = [
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-5.5', label: 'GPT-5.5' },
  { value: 'gpt-5.6-sol', label: 'GPT-5.6-sol' },
] as const;
export type FrontierModel = typeof frontierModels[number]['value'];
export const defaultFrontierModel: FrontierModel = 'gpt-5.5';
export const isFrontierModel = (value: unknown): value is FrontierModel => frontierModels.some(model => model.value === value);

/** Recorded identities stay intact; a current preference never relabels a prior call. */
export function frontierModelLabel(model: string | null | undefined): string {
  if (!model) return 'Frontier model';
  return frontierModels.find(option => option.value === model)?.label || model;
}
