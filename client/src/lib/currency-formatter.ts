// Currency formatting utility

// Map of currency codes to symbols
export const currencySymbols: Record<string, string> = {
  XAF: 'FCFA',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CNY: '¥',
  INR: '₹'
};

// Format amount based on currency code
export function formatCurrency(amount: number, currencyCode: string = 'XAF'): string {
  // Ensure amount is a valid number
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }
  
  // Convert any string to number if needed
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  // Special case for XAF (CFA Franc) - no decimals, space between amount and symbol
  if (currencyCode === 'XAF') {
    return `${Math.round(numericAmount).toLocaleString()} ${symbol}`;
  }
  
  // For other currencies, format with appropriate decimal places
  const decimals = ['JPY', 'KRW', 'IDR'].includes(currencyCode) ? 0 : 2;
  
  // Format with locale-aware number formatting
  return `${symbol}${numericAmount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}