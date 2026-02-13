export const toLocalDateKey = (value: string): number => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export const isDateInRange = (value: string, startDate: string, endDate: string): boolean => {
  const startKey = new Date(`${startDate}T00:00:00`).getTime();
  const endKey = new Date(`${endDate}T00:00:00`).getTime();
  const valueKey = toLocalDateKey(value);
  return valueKey >= startKey && valueKey <= endKey;
};
