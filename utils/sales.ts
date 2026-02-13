export const buildSaleNumber = (dateKey: string, lastSaleNumber?: string | null): string => {
  let counter = 1;
  if (lastSaleNumber) {
    const lastCounter = parseInt(lastSaleNumber.split('-').pop() || '0');
    if (!Number.isNaN(lastCounter)) {
      counter = lastCounter + 1;
    }
  }

  return `SALE-${dateKey}-${counter.toString().padStart(4, '0')}`;
};
