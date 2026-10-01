/** @jsxImportSource react */
import { frontierModels, isFrontierModel, type FrontierModel } from '../lib/frontierModels';

export function FrontierModelSelect({ value, onChange, disabled = false }: {
  value: FrontierModel; onChange: (model: FrontierModel) => void; disabled?: boolean;
}) {
  return <label className="frontier-model-select"><span>Frontier model</span><select value={value} disabled={disabled} onChange={event => { if (isFrontierModel(event.target.value)) onChange(event.target.value); }}>
    {frontierModels.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
  </select></label>;
}
