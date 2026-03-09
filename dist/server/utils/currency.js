"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_LABELS = void 0;
exports.normalizeWallet = normalizeWallet;
exports.walletToCopper = walletToCopper;
exports.walletFromCopper = walletFromCopper;
exports.toCopperByCurrency = toCopperByCurrency;
exports.parseCurrencyName = parseCurrencyName;
exports.formatWallet = formatWallet;
const SILVER_IN_COPPER = 100;
const GOLD_IN_COPPER = SILVER_IN_COPPER * 100;
const DIAMOND_IN_COPPER = GOLD_IN_COPPER * 100;
exports.CURRENCY_LABELS = {
    copper: 'cobre',
    silver: 'prata',
    gold: 'ouro',
    diamond: 'diamante'
};
function normalizeWallet(input) {
    const copper = Math.max(0, Math.floor(Number(input?.copper || 0)));
    const silver = Math.max(0, Math.floor(Number(input?.silver || 0)));
    const gold = Math.max(0, Math.floor(Number(input?.gold || 0)));
    const diamond = Math.max(0, Math.floor(Number(input?.diamond || 0)));
    return walletFromCopper(walletToCopper({ copper, silver, gold, diamond }));
}
function walletToCopper(wallet) {
    return (Math.max(0, Math.floor(Number(wallet.copper || 0)))
        + (Math.max(0, Math.floor(Number(wallet.silver || 0))) * SILVER_IN_COPPER)
        + (Math.max(0, Math.floor(Number(wallet.gold || 0))) * GOLD_IN_COPPER)
        + (Math.max(0, Math.floor(Number(wallet.diamond || 0))) * DIAMOND_IN_COPPER));
}
function walletFromCopper(totalCopper) {
    let remaining = Math.max(0, Math.floor(Number(totalCopper || 0)));
    const diamond = Math.floor(remaining / DIAMOND_IN_COPPER);
    remaining -= diamond * DIAMOND_IN_COPPER;
    const gold = Math.floor(remaining / GOLD_IN_COPPER);
    remaining -= gold * GOLD_IN_COPPER;
    const silver = Math.floor(remaining / SILVER_IN_COPPER);
    remaining -= silver * SILVER_IN_COPPER;
    const copper = remaining;
    return { copper, silver, gold, diamond };
}
function toCopperByCurrency(amount, currency) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (currency === 'diamond')
        return safeAmount * DIAMOND_IN_COPPER;
    if (currency === 'gold')
        return safeAmount * GOLD_IN_COPPER;
    if (currency === 'silver')
        return safeAmount * SILVER_IN_COPPER;
    return safeAmount;
}
function parseCurrencyName(raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (key === 'cobre' || key === 'copper')
        return 'copper';
    if (key === 'prata' || key === 'silver')
        return 'silver';
    if (key === 'ouro' || key === 'gold')
        return 'gold';
    if (key === 'diamante' || key === 'diamond')
        return 'diamond';
    return null;
}
function formatWallet(wallet) {
    const safe = normalizeWallet(wallet);
    return `${safe.copper} cobre, ${safe.silver} prata, ${safe.gold} ouro, ${safe.diamond} diamante`;
}
//# sourceMappingURL=currency.js.map