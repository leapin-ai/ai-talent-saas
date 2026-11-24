export const formatValue = value => {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value ?? value.email;
    if (number != null && String(number).trim()) {
      return String(number).trim();
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '-';
    }
  }
  return String(value);
};

export const formatDateRange = (startDate, endDate, sofar) => {
  const start = startDate ? String(startDate).slice(0, 7) : '';
  const end = sofar ? '至今' : endDate ? String(endDate).slice(0, 7) : '';
  if (start && end) {
    return `${start} ~ ${end}`;
  }
  return start || end || '-';
};
