export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  T extends (...args: any) => Promise<infer R> ? R : any;

export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const formatNumberWithSuffix = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}m`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  } else {
    return num.toFixed(2).toString();
  }
};
