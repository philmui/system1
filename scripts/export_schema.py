"""Export the authoritative public Python models for browser type generation."""

import json
from pathlib import Path

from pydantic import BaseModel, create_model

from doc_discovery import classification_measurements, lessons, review_lessons, schemas

models = {
    name: (model, ...)
    for module in (schemas, lessons, review_lessons, classification_measurements)
    for name, model in vars(module).items()
    if isinstance(model, type)
    and issubclass(model, BaseModel)
    and model.__module__ == module.__name__
    and name != "Model"
}
# Public responses serialize defaults too; require those fields in browser records.
for model, _ in models.values():
    model.model_config["json_schema_serialization_defaults_required"] = True

contract = create_model("ApiContract", **models)
path = Path(__file__).resolve().parents[1] / "frontend/src/lib/api.schema.json"
path.write_text(json.dumps(contract.model_json_schema(mode="serialization"), indent=2) + "\n")
print(f"Exported {len(models)} public models to {path.relative_to(path.parents[3])}")
