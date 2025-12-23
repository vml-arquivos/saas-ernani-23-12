/**
 * Utilitário para cálculo de financiamento imobiliário (Tabela SAC e PRICE).
 * Todos os valores de entrada e saída são em centavos (inteiros) para evitar problemas de ponto flutuante,
 * exceto a taxa de juros, que é um decimal (ex: 0.08 para 8% ao ano).
 */

interface CalculationInput {
  financedAmount: number; // Valor financiado (em centavos)
  annualInterestRate: number; // Taxa de juros anual (ex: 0.08)
  termInMonths: number; // Prazo em meses
}

interface CalculationResult {
  firstInstallment: number; // Primeira parcela (em centavos)
  lastInstallment: number; // Última parcela (em centavos)
  totalPaid: number; // Total pago (principal + juros, em centavos)
  totalInterest: number; // Total de juros (em centavos)
}

const calculateMonthlyRate = (annualRate: number): number => {
  // Taxa mensal = (1 + Taxa Anual)^(1/12) - 1
  return Math.pow(1 + annualRate, 1 / 12) - 1;
};

/**
 * Calcula o financiamento pela Tabela PRICE (Parcelas Constantes).
 */
export const calculatePrice = ({
  financedAmount,
  annualInterestRate,
  termInMonths,
}: CalculationInput): CalculationResult => {
  const monthlyRate = calculateMonthlyRate(annualInterestRate);
  const i = monthlyRate;
  const n = termInMonths;
  const PV = financedAmount;

  if (i === 0) {
    // Sem juros
    const installment = Math.round(PV / n);
    const totalPaid = installment * n;
    return {
      firstInstallment: installment,
      lastInstallment: installment,
      totalPaid: totalPaid,
      totalInterest: 0,
    };
  }

  // Fórmula da Parcela Constante (PMT)
  const pmt = PV * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  const installment = Math.round(pmt);

  // Total pago = Parcela * Prazo
  const totalPaid = installment * n;

  // Total de juros = Total pago - Valor financiado
  const totalInterest = totalPaid - PV;

  return {
    firstInstallment: installment,
    lastInstallment: installment,
    totalPaid: totalPaid,
    totalInterest: totalInterest,
  };
};

/**
 * Calcula o financiamento pelo Sistema de Amortização Constante (SAC).
 */
export const calculateSac = ({
  financedAmount,
  annualInterestRate,
  termInMonths,
}: CalculationInput): CalculationResult => {
  const monthlyRate = calculateMonthlyRate(annualInterestRate);
  const i = monthlyRate;
  const n = termInMonths;
  let outstandingBalance = financedAmount;
  let totalInterest = 0;
  const amortization = financedAmount / n;

  let firstInstallment = 0;
  let lastInstallment = 0;

  for (let k = 1; k <= n; k++) {
    // Juros do período: Saldo Devedor Anterior * Taxa Mensal
    const interest = outstandingBalance * i;
    const installment = amortization + interest;

    // Acumula juros
    totalInterest += interest;

    // Salva primeira e última parcela
    if (k === 1) {
      firstInstallment = Math.round(installment);
    }
    if (k === n) {
      lastInstallment = Math.round(installment);
    }

    // Atualiza Saldo Devedor
    outstandingBalance -= amortization;
  }

  const totalPaid = financedAmount + Math.round(totalInterest);

  return {
    firstInstallment: firstInstallment,
    lastInstallment: lastInstallment,
    totalPaid: totalPaid,
    totalInterest: Math.round(totalInterest),
  };
};
