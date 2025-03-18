import { differenceInDays } from 'date-fns';

interface InflationAnalysis {
  effectiveInterestRate: number;  // Annual rate
  absoluteGain: number;          // In rupees
  relativeGain: number;          // Percentage
  daysDelayed: number;
  recommendation: string;
}

export const calculateInflationImpact = (
  amount: number,
  startDate: string,
  endDate: string,
  inflationRate: number = 6.0, // Default annual inflation rate
  alternativeLendingRate: number = 12.0 // Default annual lending rate
): InflationAnalysis => {
  const days = differenceInDays(new Date(endDate), new Date(startDate));
  
  // Convert annual rates to daily rates
  const dailyInflationRate = inflationRate / 365 / 100;
  const dailyLendingRate = alternativeLendingRate / 365 / 100;

  // Calculate the time value of money
  const inflationAdjustedAmount = amount * Math.pow(1 + dailyInflationRate, days);
  const lendingAdjustedAmount = amount * Math.pow(1 + dailyLendingRate, days);

  // Calculate gains/losses
  const absoluteGain = amount - inflationAdjustedAmount;
  const relativeGain = (absoluteGain / amount) * 100;
  const effectiveInterestRate = (Math.pow(inflationAdjustedAmount / amount, 365 / days) - 1) * 100;

  // Generate recommendation
  let recommendation = '';
  if (days > 0) {
    if (lendingAdjustedAmount - inflationAdjustedAmount > 1000) {
      recommendation = 'Favorable credit terms. The inflation rate is lower than typical lending rates.';
    } else if (absoluteGain > 0) {
      recommendation = 'Neutral position. Consider negotiating better terms.';
    } else {
      recommendation = 'Unfavorable terms. Consider early payment or renegotiation.';
    }
  }

  return {
    effectiveInterestRate,
    absoluteGain,
    relativeGain,
    daysDelayed: days,
    recommendation
  };
};

export const calculateCreditBuyerROI = (
  amount: number,
  startDate: string,
  endDate: string,
  inflationRate: number = 6.0, // Default annual inflation rate
  businessGrowthRate: number = 15.0 // Default annual business growth rate
): InflationAnalysis => {
  const days = differenceInDays(new Date(endDate), new Date(startDate));
  
  // Convert annual rates to daily rates
  const dailyInflationRate = inflationRate / 365 / 100;
  const dailyGrowthRate = businessGrowthRate / 365 / 100;

  // Calculate the opportunity cost
  const inflationAdjustedAmount = amount * Math.pow(1 + dailyInflationRate, days);
  const growthAdjustedAmount = amount * Math.pow(1 + dailyGrowthRate, days);

  // Calculate ROI
  const absoluteGain = growthAdjustedAmount - inflationAdjustedAmount;
  const relativeGain = (absoluteGain / amount) * 100;
  const effectiveInterestRate = (Math.pow(growthAdjustedAmount / amount, 365 / days) - 1) * 100;

  // Generate recommendation
  let recommendation = '';
  if (days > 0) {
    if (absoluteGain > 1000) {
      recommendation = 'Credit is being effectively utilized for business growth.';
    } else if (absoluteGain > 0) {
      recommendation = 'Marginal benefit. Consider optimizing credit usage.';
    } else {
      recommendation = 'Credit cost exceeds business returns. Review credit strategy.';
    }
  }

  return {
    effectiveInterestRate,
    absoluteGain,
    relativeGain,
    daysDelayed: days,
    recommendation
  };
};
