import { db } from '../db.js';
import { config } from '../config.js';
import { catalog, findItem, editableColumns } from '../catalog.js';
import { badRequest, notFound } from '../errors.js';

const selectProgress = db.prepare('SELECT item_id, field, value FROM user_progress WHERE user_id = ?');
const upsertProgress = db.prepare(`
  INSERT INTO user_progress (user_id, item_id, field, value, updated_at)
  VALUES (@userId, @itemId, @field, @value, datetime('now'))
  ON CONFLICT (user_id, item_id, field)
  DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

// ------------------------------------------------------------------ merging

function loadOverrides(userId) {
  const byItem = new Map();
  for (const { item_id, field, value } of selectProgress.all(userId)) {
    if (!byItem.has(item_id)) byItem.set(item_id, {});
    byItem.get(item_id)[field] = value;
  }
  return byItem;
}

function mergedValues(sheet, row, overrides = {}) {
  const values = { ...row.values };

  if (!config.useWorkbookProgress) {
    for (const col of sheet.columns) {
      if (col.type === 'status') values[col.key] = catalog.statusSets[sheet.statusSet].initial;
      if (col.type === 'confidence') values[col.key] = 1;
    }
  }

  const editable = editableColumns(sheet.key);
  for (const [field, value] of Object.entries(overrides)) {
    const col = editable.get(field);
    if (!col) continue; // column was removed from the workbook since this was saved
    values[field] = col.type === 'confidence' ? Number(value) : value;
  }
  return values;
}

export function getTrackerForUser(userId) {
  const overrides = loadOverrides(userId);
  return {
    statusSets: catalog.statusSets,
    sheets: catalog.sheets.map((sheet) => {
      const { rows, ...meta } = sheet;
      return {
        ...meta,
        rows: rows.map((row) => ({ id: row.id, values: mergedValues(sheet, row, overrides.get(row.id)) })),
      };
    }),
  };
}

// ------------------------------------------------------------------ updating

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(col, sheet, value) {
  switch (col.type) {
    case 'status': {
      const { options } = catalog.statusSets[sheet.statusSet];
      if (typeof value === 'string' && options.includes(value)) return value;
      throw badRequest(`"${value}" is not a valid status for this list.`);
    }
    case 'confidence': {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1 && n <= 5) return String(n);
      throw badRequest('Confidence must be a whole number from 1 to 5.');
    }
    case 'date': {
      if (value === '') return '';
      if (typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value))) return value;
      throw badRequest('Dates must look like 2026-12-31.');
    }
    case 'input':
    case 'note': {
      const max = col.type === 'input' ? 300 : 2000;
      if (typeof value !== 'string') throw badRequest(`${col.label} must be text.`);
      if (value.length > max) throw badRequest(`${col.label} can be at most ${max} characters.`);
      return value;
    }
    default:
      throw badRequest(`${col.label} can't be edited.`);
  }
}

export function updateItem(userId, itemId, changes) {
  const found = findItem(itemId);
  if (!found) throw notFound('That item no longer exists.');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
    throw badRequest('Send an object with the fields to change.');
  }

  const editable = editableColumns(found.sheet.key);
  const rows = Object.entries(changes).map(([field, raw]) => {
    const col = editable.get(field);
    if (!col) throw badRequest(`"${field}" can't be edited on this item.`);
    return { userId, itemId, field, value: validate(col, found.sheet, raw) };
  });

  db.transaction(() => rows.forEach((r) => upsertProgress.run(r)))();

  const overrides = loadOverrides(userId).get(itemId);
  return mergedValues(found.sheet, found.row, overrides);
}

// ------------------------------------------------------------------ dashboard

const priorityRank = (p = '') => (/^must/i.test(p) ? 0 : /^high/i.test(p) ? 1 : 2);

function countBy(values, options) {
  const counts = Object.fromEntries(options.map((o) => [o, 0]));
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

export function getDashboard(userId) {
  const { sheets } = getTrackerForUser(userId);
  const sets = catalog.statusSets;
  const learning = sets.learning;

  const roadmaps = sheets.filter((s) => s.kind === 'roadmap');

  const tracks = roadmaps.map((sheet) => {
    const counts = countBy(sheet.rows.map((r) => r.values.status), learning.options);
    const phases = [];
    for (const row of sheet.rows) {
      const name = row.values[sheet.groupBy];
      let phase = phases.find((p) => p.name === name);
      if (!phase) phases.push((phase = { name, total: 0, counts: countBy([], learning.options) }));
      phase.total += 1;
      phase.counts[row.values.status] += 1;
    }
    const total = sheet.rows.length;
    return { key: sheet.key, title: sheet.title, total, counts, completion: total ? counts.Done / total : 0, phases };
  });

  const totalCounts = countBy([], learning.options);
  for (const t of tracks) for (const [k, v] of Object.entries(t.counts)) totalCounts[k] += v;
  const total = tracks.reduce((sum, t) => sum + t.total, 0);

  // "Continue with": things already in motion first (Pending, then Revision), most important first.
  const roadmapItems = roadmaps.flatMap((sheet) =>
    sheet.rows.map((row, index) => ({
      id: row.id, sheetKey: sheet.key, sheetTitle: sheet.title, index,
      title: row.values.skill, phase: row.values[sheet.groupBy],
      status: row.values.status, priority: row.values.priority,
    })),
  );
  const stateRank = { Pending: 0, Revision: 1 };
  let nextUp = roadmapItems
    .filter((i) => i.status in stateRank)
    .sort((a, b) => stateRank[a.status] - stateRank[b.status] || priorityRank(a.priority) - priorityRank(b.priority) || a.index - b.index);
  let nextUpKind = 'continue';
  if (nextUp.length === 0) {
    nextUpKind = 'start';
    nextUp = roadmapItems.filter((i) => i.status === learning.initial && priorityRank(i.priority) === 0);
  }

  const lists = sheets
    .filter((s) => s.kind !== 'roadmap' && s.statusSet && sets[s.statusSet].checkable)
    .map((s) => {
      const spec = sets[s.statusSet];
      const counts = countBy(s.rows.map((r) => r.values.status), spec.options);
      return { key: s.key, title: s.title, statusSet: s.statusSet, total: s.rows.length, counts, done: counts[spec.done] };
    });

  const applications = sheets
    .filter((s) => s.statusSet === 'application')
    .map((s) => ({
      key: s.key, title: s.title, total: s.rows.length,
      counts: countBy(s.rows.map((r) => r.values.status), sets.application.options),
    }));

  return {
    totals: { total, counts: totalCounts, completion: total ? totalCounts.Done / total : 0 },
    tracks,
    nextUp: { kind: nextUpKind, items: nextUp.slice(0, 6) },
    lists,
    applications,
  };
}
