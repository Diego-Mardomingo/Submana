/**
 * Efecto neto de las transacciones sobre el saldo (ingresos suman, gastos restan).
 * Para reconstruir saldos históricos se usan TODAS las transacciones: los traspasos y
 * las categorías excluidas de métricas también mueven dinero de la cuenta.
 */
export function netBalanceChange(transactions: { amount?: number | string; type?: string }[]): number {
	let net = 0;
	for (const tx of transactions) {
		const amount = Number(tx.amount) || 0;
		if (tx.type === "income") net += amount;
		else net -= amount;
	}
	return net;
}
