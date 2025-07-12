// Money utility functions to handle cents/dollars conversion and precise calculations

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

export function addMoney(...amounts: number[]): number {
  // Convert to cents, add, then convert back to dollars
  const totalCents = amounts.reduce((sum, amount) => sum + dollarsToCents(amount), 0)
  return centsToDollars(totalCents)
}

export function multiplyMoney(amount: number, multiplier: number): number {
  // Convert to cents, multiply, round, then convert back
  const cents = dollarsToCents(amount)
  const resultCents = Math.round(cents * multiplier)
  return centsToDollars(resultCents)
}

export function calculateTax(subtotal: number, taxRate: number = 0.06): number {
  return multiplyMoney(subtotal, taxRate)
}

export function formatMoney(amount: number): string {
  return amount.toFixed(2)
}

// For precise money calculations, work in cents then convert to dollars
export class MoneyCalculator {
  private cents: number = 0

  constructor(dollars: number = 0) {
    this.cents = dollarsToCents(dollars)
  }

  add(dollars: number): MoneyCalculator {
    this.cents += dollarsToCents(dollars)
    return this
  }

  subtract(dollars: number): MoneyCalculator {
    this.cents -= dollarsToCents(dollars)
    return this
  }

  multiply(factor: number): MoneyCalculator {
    this.cents = Math.round(this.cents * factor)
    return this
  }

  toDollars(): number {
    return centsToDollars(this.cents)
  }

  toCents(): number {
    return this.cents
  }

  static from(dollars: number): MoneyCalculator {
    return new MoneyCalculator(dollars)
  }
}