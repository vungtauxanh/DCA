export type SpacingStrategy = "linear" | "fibonacci" | "martingale" | "custom";
export type PositionType = "long" | "short";
export type VolumeStrategy = "equal_target" | "equal_margin" | "martingale";

export interface StrategyParams {
  positionType: PositionType;
  leverage: number;
  startPrice: number;
  endPrice: number;
  targetPrice: number;
  numberOfOrders: number;
  totalInvestment: number;
  spacingStrategy: SpacingStrategy;
  customExponent?: number; // for custom DCA curve
  volumeStrategy: VolumeStrategy;
  volumeMultiplier: number; // for martingale volume
}

export interface OrderRecord {
  id: number;
  buyPrice: number;
  investAmount: number; // Margin
  positionSize: number; // Leveraged value
  coinAmount: number;
  targetValue: number;
  profit: number;
  roi: number;
}

export function calculateOrders(params: StrategyParams): OrderRecord[] {
  let {
    positionType,
    leverage = 1,
    startPrice,
    endPrice,
    targetPrice,
    numberOfOrders,
    totalInvestment,
    spacingStrategy,
    customExponent = 2,
    volumeStrategy = "equal_target",
    volumeMultiplier = 2,
  } = params;

  // Tự động điều chỉnh khoảng giá (Lệnh cuối không được lỗ)
  if (positionType === "long" && endPrice > targetPrice) {
    endPrice = targetPrice;
  } else if (positionType === "short" && endPrice < targetPrice) {
    endPrice = targetPrice;
  }

  if (numberOfOrders <= 0 || targetPrice <= 0 || totalInvestment <= 0) return [];

  const orders: OrderRecord[] = [];
  const range = endPrice - startPrice;

  // Tính toán các mốc giá
  let prices: number[] = [];
  
  if (numberOfOrders === 1) {
    prices = [startPrice];
  } else {
    if (spacingStrategy === "linear") {
      for (let i = 0; i < numberOfOrders; i++) {
        prices.push(startPrice + range * (i / (numberOfOrders - 1)));
      }
    } else if (spacingStrategy === "fibonacci") {
      const fib = [1, 1];
      for (let i = 2; i < numberOfOrders; i++) {
        fib.push(fib[i - 1] + fib[i - 2]);
      }
      let cumulativeFib = 0;
      const totalFibSpace = fib.slice(1).reduce((a, b) => a + b, 0);
      
      prices.push(startPrice);
      for (let i = 1; i < numberOfOrders; i++) {
        cumulativeFib += fib[i];
        prices.push(startPrice + range * (cumulativeFib / totalFibSpace));
      }
    } else if (spacingStrategy === "martingale") {
      const powers = Array.from({ length: numberOfOrders - 1 }, (_, i) => Math.pow(2, i));
      const sumPowers = powers.reduce((a, b) => a + b, 0);
      
      prices.push(startPrice);
      let cumulativePower = 0;
      for (let i = 1; i < numberOfOrders; i++) {
        cumulativePower += powers[i - 1];
        prices.push(startPrice + range * (cumulativePower / sumPowers));
      }
    } else if (spacingStrategy === "custom") {
      for (let i = 0; i < numberOfOrders; i++) {
        const fraction = Math.pow(i / (numberOfOrders - 1), customExponent);
        prices.push(startPrice + range * fraction);
      }
    }
  }

  // Đảm bảo không vượt quá/dưới End Price do sai số
  if (startPrice <= endPrice) {
    prices = prices.map(p => Math.min(p, endPrice));
  } else {
    prices = prices.map(p => Math.max(p, endPrice));
  }

  // Tính hệ số lợi nhuận K_i cho từng mức giá
  const kValues: number[] = [];
  for (let i = 0; i < numberOfOrders; i++) {
    const buyPrice = prices[i];
    let k = 0;
    if (positionType === "long") {
      k = 1 + leverage * ((targetPrice / buyPrice) - 1);
    } else {
      k = 1 + leverage * (1 - (targetPrice / buyPrice));
    }
    
    // Giới hạn k > 0 để tránh chia cho 0 nếu lệnh bị thanh lý trước khi tới Target
    if (k <= 0) k = 0.0001; 
    
    kValues.push(k);
  }

  // Phân bổ vốn (Margin)
  const margins: number[] = [];
  if (volumeStrategy === "equal_target") {
    const sumInvK = kValues.reduce((sum, k) => sum + (1 / k), 0);
    const targetValuePerOrder = totalInvestment / sumInvK;
    for (let i = 0; i < numberOfOrders; i++) {
      margins.push(targetValuePerOrder / kValues[i]);
    }
  } else if (volumeStrategy === "martingale") {
    const weights: number[] = [];
    for (let i = 0; i < numberOfOrders; i++) {
      weights.push(Math.pow(volumeMultiplier, i));
    }
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < numberOfOrders; i++) {
      margins.push(totalInvestment * (weights[i] / sumWeights));
    }
  } else if (volumeStrategy === "equal_margin") {
    const marginPerOrder = totalInvestment / numberOfOrders;
    for (let i = 0; i < numberOfOrders; i++) {
      margins.push(marginPerOrder);
    }
  }

  // Phân bổ vốn và tính toán thông số từng lệnh
  for (let i = 0; i < numberOfOrders; i++) {
    const buyPrice = prices[i];
    
    // Đảm bảo ký quỹ tối thiểu là 0.52
    const investAmount = Math.max(0.52, margins[i]);
    const positionSize = investAmount * leverage;
    const coinAmount = positionSize / buyPrice;
    
    let profit = 0;
    if (positionType === "long") {
      profit = (targetPrice - buyPrice) * coinAmount;
    } else {
      profit = (buyPrice - targetPrice) * coinAmount;
    }
    
    const targetValue = investAmount + profit;
    const roi = investAmount > 0 ? (profit / investAmount) * 100 : 0;

    orders.push({
      id: i + 1,
      buyPrice,
      investAmount,
      positionSize,
      coinAmount,
      targetValue,
      profit,
      roi,
    });
  }

  return orders;
}
