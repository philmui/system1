import { useState } from 'react';
import { defaultFrontierModel, isFrontierModel, type FrontierModel } from './frontierModels';

const preferenceKey = 'discovery.frontier-model';
function initialModel(): FrontierModel {
  try {
    const saved = localStorage.getItem(preferenceKey);
    return isFrontierModel(saved) ? saved : defaultFrontierModel;
  } catch { return defaultFrontierModel; }
}

/** Preference only: changing it never changes server settings or starts a request. */
export function useFrontierModel() {
  const [model, setModel] = useState<FrontierModel>(initialModel);
  const select = (value: FrontierModel) => {
    setModel(value);
    try { localStorage.setItem(preferenceKey, value); } catch { /* Private storage may be unavailable. */ }
  };
  return [model, select] as const;
}
