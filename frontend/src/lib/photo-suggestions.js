// Replace only empty fields or values still owned by the previous photo result.
// Text and selections edited by the citizen must survive later photo responses.
export function mergePhotoSuggestions(current, suggestions, previous = {}) {
  const values = { ...current };
  const autoFilled = { ...previous };
  if (suggestions?.source !== 'ai') return { values, autoFilled };
  const proposed = {
    title: suggestions.suggested_title,
    description: suggestions.suggested_description,
    category: suggestions.category_hint,
    departmentId: suggestions.department_id,
  };
  if (current.category && current.category !== previous.category && current.category !== suggestions.category_hint) {
    proposed.departmentId = null;
  }
  for (const [field, value] of Object.entries(proposed)) {
    if (value && (!current[field]?.trim() || current[field] === previous[field])) {
      values[field] = value;
      autoFilled[field] = value;
    }
  }
  return { values, autoFilled };
}

export function clearPhotoSuggestions(current, previous = {}) {
  return Object.fromEntries(Object.entries(current).map(([field, value]) => [
    field, previous[field] && value === previous[field] ? '' : value,
  ]));
}
