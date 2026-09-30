import { compile } from 'json-schema-to-typescript';
import { readFile, writeFile } from 'node:fs/promises';
const schema = JSON.parse(await readFile('src/lib/api.schema.json', 'utf8'));
const types = await compile(schema, 'ApiContract', {
  bannerComment: '/* Generated from src/doc_discovery/schemas.py. Run npm run generate:types; do not edit. */',
  additionalProperties: false,
  style: { singleQuote: true, semi: true },
});
await writeFile('src/lib/api.generated.ts', types);
console.log('Generated frontend/src/lib/api.generated.ts');
