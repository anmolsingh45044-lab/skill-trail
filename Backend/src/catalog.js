import fs from 'node:fs';
import path from 'node:path';
import { backendRoot } from './config.js';

const file = path.join(backendRoot, 'data', 'catalog.json');

if (!fs.existsSync(file)) {
  throw new Error('Backend/data/catalog.json is missing. Run "npm run convert" to build it from the Excel workbook.');
}

export const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));

const items = new Map();
const editableBySheet = new Map();

for (const sheet of catalog.sheets) {
  editableBySheet.set(sheet.key, new Map(sheet.columns.filter((c) => c.editable).map((c) => [c.key, c])));
  for (const row of sheet.rows) items.set(row.id, { sheet, row });
}

export const findItem = (id) => items.get(id);
export const editableColumns = (sheetKey) => editableBySheet.get(sheetKey);
