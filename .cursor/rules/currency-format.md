# Formato de Moneda (Euros)

## Regla

Todos los números que representen cantidades en euros deben formatearse usando el sistema español, **independientemente del idioma seleccionado** por el usuario:

- **Decimales**: coma (`,`)
- **Millares**: punto (`.`)
- **Símbolo**: `€` al final con un espacio

## Implementación

Usar siempre `"es-ES"` como locale en `Intl.NumberFormat`:

```typescript
const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};
```

## Ejemplos

| Valor     | Formato correcto |
|-----------|------------------|
| 1234.56   | 1.234,56 €       |
| 99.99     | 99,99 €          |
| 1000000   | 1.000.000,00 €   |

## Archivos afectados

- `src/components/AccountsBody.tsx`
- `src/components/AccountDetail.tsx`
- `src/components/SubscriptionDetail.tsx`
- `src/components/SubscriptionsBody.tsx`
- `src/components/CalendarBody.tsx`
- `src/components/CalendarDayList.tsx`
- `src/components/TransactionsBody.tsx`

Cualquier nuevo componente que muestre precios o balances debe seguir esta misma convención.
