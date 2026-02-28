export type BankProvider = "trade_republic" | "revolut" | "cash";

export interface BankProviderConfig {
  id: BankProvider;
  name: string;
  icon: string;
  acceptedFormats: string[];
  formatLabel: string;
}

export const BANK_PROVIDERS: Record<BankProvider, BankProviderConfig> = {
  trade_republic: {
    id: "trade_republic",
    name: "Trade Republic",
    icon: "https://cdn.brandfetch.io/traderepublic.com/w/400/h/400?c=1id-tf6xJEAcHu0Tio1",
    acceptedFormats: [".pdf"],
    formatLabel: "PDF",
  },
  revolut: {
    id: "revolut",
    name: "Revolut",
    icon: "https://cdn.brandfetch.io/revolut.com/w/400/h/400?c=1id-tf6xJEAcHu0Tio1",
    acceptedFormats: [".xlsx", ".xls", ".csv"],
    formatLabel: "Excel/CSV",
  },
  cash: {
    id: "cash",
    name: "Efectivo",
    icon: "https://api.iconify.design/mdi:cash.svg?color=%234CAF50",
    acceptedFormats: [],
    formatLabel: "",
  },
};

export const BANK_PROVIDER_LIST = Object.values(BANK_PROVIDERS);

export function getBankProvider(id: string | null | undefined): BankProviderConfig | null {
  if (!id) return null;
  return BANK_PROVIDERS[id as BankProvider] || null;
}
