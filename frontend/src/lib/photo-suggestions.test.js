import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPhotoSuggestions, mergePhotoSuggestions } from './photo-suggestions.js';

const empty = { title: '', description: '', category: '', departmentId: '' };
const pipe = { source: 'ai', suggested_title: 'Broken water pipe', suggested_description: 'Water sprays from a damaged pipe joint.', category_hint: 'water', department_id: 'water-department' };

test('a successful pipe result fills all four empty complaint fields', () => {
  const { values } = mergePhotoSuggestions(empty, pipe);
  assert.equal(values.title, pipe.suggested_title);
  assert.equal(values.description, pipe.suggested_description);
  assert.equal(values.category, 'water');
  assert.equal(values.departmentId, 'water-department');
});

test('switching photos clears old auto-fill, allowing a different description without retaining road text', () => {
  const road = { source: 'ai', suggested_title: 'Pothole', suggested_description: 'A hole in the road.', category_hint: 'roads', department_id: 'roads-department' };
  const first = mergePhotoSuggestions(empty, road);
  const cleared = clearPhotoSuggestions(first.values, first.autoFilled);
  assert.deepEqual(cleared, empty);
  const next = mergePhotoSuggestions(cleared, pipe);
  assert.equal(next.values.description, pipe.suggested_description);
  assert.equal(next.values.category, 'water');
});

test('manual edits and selections survive new photos and reruns', () => {
  const first = mergePhotoSuggestions(empty, pipe);
  const edited = { ...first.values, title: 'Leak outside my house', description: 'Water has been leaking since morning.', category: 'other' };
  const cleared = clearPhotoSuggestions(edited, first.autoFilled);
  const next = mergePhotoSuggestions(cleared, pipe);
  assert.equal(next.values.title, edited.title);
  assert.equal(next.values.description, edited.description);
  assert.equal(next.values.category, 'other');
  assert.equal(next.values.departmentId, '');
  const rerun = mergePhotoSuggestions(edited, pipe, first.autoFilled);
  assert.equal(rerun.values.description, edited.description);
});

test('failed analysis never fills or overwrites complaint fields', () => {
  const failure = { source: 'fallback', suggested_title: 'Invented road', suggested_description: 'Invented description', category_hint: 'roads', department_id: 'roads' };
  assert.deepEqual(mergePhotoSuggestions(empty, failure).values, empty);
  const existing = { ...empty, title: 'My complaint', description: 'My own description.' };
  assert.deepEqual(mergePhotoSuggestions(existing, failure).values, existing);
});
