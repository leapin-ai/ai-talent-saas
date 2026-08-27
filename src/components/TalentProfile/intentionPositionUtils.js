const normalizeIntentionRaw = raw => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') {
    return raw.id || raw.name || raw.value || null;
  }
  return raw;
};

export const toIntentionSelectValue = (intentionPosition, positionEnums) => {
  const list = Array.isArray(intentionPosition) ? intentionPosition : [];
  const idToName = new Map((positionEnums || []).map(item => [String(item.value), item.description]));
  const nameToId = new Map((positionEnums || []).map(item => [String(item.description), String(item.value)]));

  return list
    .map(raw => {
      if (raw && typeof raw === 'object' && (raw.id != null || raw.name)) {
        const id = raw.id != null ? String(raw.id) : nameToId.get(String(raw.name));
        const name = raw.name || (id && idToName.get(String(id))) || '';
        if (id && name) return { id, name };
        if (id && idToName.has(id)) return { id, name: idToName.get(id) };
        if (name && nameToId.has(name)) return { id: nameToId.get(name), name };
        return null;
      }
      const str = String(normalizeIntentionRaw(raw) || '');
      if (!str) return null;
      if (idToName.has(str)) return { id: str, name: idToName.get(str) };
      if (nameToId.has(str)) return { id: nameToId.get(str), name: str };
      return null;
    })
    .filter(Boolean);
};

export const fromIntentionSelectValue = intentionPosition => {
  const list = Array.isArray(intentionPosition) ? intentionPosition : [];
  return list
    .map(raw => {
      if (raw && typeof raw === 'object') {
        return raw.id != null ? String(raw.id) : raw.name || null;
      }
      return raw == null || raw === '' ? null : String(raw);
    })
    .filter(Boolean);
};

export const resolveIntentionDisplay = (raw, positionEnums) => {
  const value = raw && typeof raw === 'object' ? raw.name || raw.id || raw.value : raw;
  if (value == null || value === '') return null;
  const str = String(value);
  const idToName = new Map((positionEnums || []).map(item => [String(item.value), item.description]));
  const nameToId = new Map((positionEnums || []).map(item => [String(item.description), String(item.value)]));
  if (idToName.has(str)) {
    return { positionId: str, position: idToName.get(str) };
  }
  const idFromName = nameToId.get(str);
  return { positionId: idFromName || null, position: str };
};

export const ensurePositionEnums = async ({ ajax, positionDetailApi, refs, existingEnums }) => {
  const map = new Map((existingEnums || []).map(item => [String(item.value), Object.assign({}, item, { value: String(item.value) })]));
  const ids = (refs || [])
    .map(r => (r && typeof r === 'object' ? r.id || r.value : r))
    .filter(Boolean)
    .map(String);
  const missing = ids.filter(id => !map.has(id));
  if (!missing.length || !ajax || !positionDetailApi) {
    return Array.from(map.values());
  }
  await Promise.all(
    missing.map(async id => {
      try {
        const { data } = await ajax(Object.assign({}, positionDetailApi, { params: { id } }));
        const row = data?.code === 0 ? data.data : null;
        if (row?.id != null && row.name) {
          map.set(String(row.id), {
            value: String(row.id),
            description: row.name,
            tenantOrgId: row.tenantOrgId || null
          });
        }
      } catch (e) {
        // ignore
      }
    })
  );
  return Array.from(map.values());
};
