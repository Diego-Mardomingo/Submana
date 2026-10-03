const BRANDFETCH_CLIENT = "1id-tf6xJEAcHu0Tio1";

/** Square brand logo for a domain. */
export const brandLogo = (domain: string) => `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${BRANDFETCH_CLIENT}`;
export const brandSearchUrl = (term: string) => `https://api.brandfetch.io/v2/search/${encodeURIComponent(term)}?c=${BRANDFETCH_CLIENT}`;

export type BankProvider = "trade_republic" | "revolut" | "bbva" | "imagin" | "cash";

interface BankProviderConfig {
  id: BankProvider;
  name: string;
  icon: string;
  acceptedFormats: string[];
  formatLabel: string;
}

export const BANK_PROVIDERS: Record<BankProvider, BankProviderConfig> = {
  trade_republic: { id: "trade_republic", name: "Trade Republic", icon: brandLogo("traderepublic.com"), acceptedFormats: [".pdf"], formatLabel: "PDF" },
  revolut: { id: "revolut", name: "Revolut", icon: brandLogo("revolut.com"), acceptedFormats: [".xlsx", ".xls", ".csv"], formatLabel: "Excel/CSV" },
  bbva: { id: "bbva", name: "BBVA", icon: brandLogo("bbva.es"), acceptedFormats: [".xlsx", ".xls"], formatLabel: "Excel" },
  imagin: { id: "imagin", name: "Imagin", icon: brandLogo("imagin.com"), acceptedFormats: [".csv"], formatLabel: "CSV" },
  cash: { id: "cash", name: "Efectivo", icon: "https://api.iconify.design/mdi:cash.svg?color=%234CAF50", acceptedFormats: [], formatLabel: "" },
};

export const BANK_PROVIDER_LIST = Object.values(BANK_PROVIDERS);

export function getBankProvider(id: string | null | undefined): BankProviderConfig | null {
  return (id && BANK_PROVIDERS[id as BankProvider]) || null;
}

/** Dedicated account the Revolut savings ("remunerada") rows are imported into. */
export const DEPOSIT_ACCOUNT_NAME = "Revolut Remunerada";
