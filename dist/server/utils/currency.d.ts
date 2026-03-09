export type Wallet = {
    copper: number;
    silver: number;
    gold: number;
    diamond: number;
};
export type CurrencyName = keyof Wallet;
export declare const CURRENCY_LABELS: Record<CurrencyName, string>;
export declare function normalizeWallet(input: Partial<Wallet> | null | undefined): Wallet;
export declare function walletToCopper(wallet: Wallet): number;
export declare function walletFromCopper(totalCopper: number): Wallet;
export declare function toCopperByCurrency(amount: number, currency: CurrencyName): number;
export declare function parseCurrencyName(raw: string): CurrencyName | null;
export declare function formatWallet(wallet: Wallet): string;
//# sourceMappingURL=currency.d.ts.map