import { useState, useMemo, useRef } from "react";
import { Calculator, LineChart as LineChartIcon, LayoutDashboard, Settings2, Target, TrendingDown, ShieldCheck, Sparkles, Image as ImageIcon, Loader2 } from "lucide-react";
import { calculateOrders, StrategyParams, SpacingStrategy } from "./types";
import { formatCurrency, formatNumber, cn } from "./utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart
} from "recharts";

export default function App() {
  const [params, setParams] = useState<StrategyParams>({
    positionType: "short",
    leverage: 10,
    startPrice: 0.3,
    endPrice: 0.5,
    targetPrice: 0.2,
    numberOfOrders: 4,
    totalInvestment: 1000,
    spacingStrategy: "linear",
    customExponent: 2,
    volumeStrategy: "martingale",
    volumeMultiplier: 2.0,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      
      setParams((prev) => ({
        ...prev,
        startPrice: data.startPrice || prev.startPrice,
        endPrice: data.endPrice || prev.endPrice,
        targetPrice: data.targetPrice || prev.targetPrice,
        positionType: data.positionType === "long" || data.positionType === "short" ? data.positionType : prev.positionType,
      }));
    } catch (error) {
      console.error(error);
      alert("Lỗi khi phân tích ảnh. Vui lòng thử lại.");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleParamChange = (key: keyof StrategyParams, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const orders = useMemo(() => calculateOrders(params), [params]);

  const totalInvested = orders.reduce((sum, order) => sum + order.investAmount, 0);
  const totalTargetValue = orders.reduce((sum, order) => sum + order.targetValue, 0);
  const totalProfit = orders.reduce((sum, order) => sum + order.profit, 0);
  const totalCoins = orders.reduce((sum, order) => sum + order.coinAmount, 0);
  const totalPositionSize = orders.reduce((sum, order) => sum + order.positionSize, 0);
  
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const avgEntryPrice = totalCoins > 0 ? totalPositionSize / totalCoins : 0;
  const breakEvenPrice = avgEntryPrice; // Assuming no fees
  
  const lastOrder = orders[orders.length - 1];
  const lastBuyPrice = lastOrder ? lastOrder.buyPrice : 0;
  const maxDrawdownAmount = params.positionType === "long" 
    ? totalInvested - (totalCoins * lastBuyPrice)
    : (totalCoins * lastBuyPrice) - totalInvested; // For short, loss happens when price goes up above entry
    
  const maxDrawdownPercent = totalInvested > 0 ? (maxDrawdownAmount / totalInvested) * 100 : 0;
  
  const safetyMargin = lastBuyPrice > 0 ? 
    (params.positionType === "long" 
      ? ((params.targetPrice - lastBuyPrice) / params.targetPrice) * 100
      : ((lastBuyPrice - params.targetPrice) / params.targetPrice) * 100) 
    : 0;

  // Chart data
  const chartData = useMemo(() => {
    const data = [];
    const minPrice = Math.min(params.startPrice, params.endPrice, params.targetPrice);
    const maxPrice = Math.max(params.startPrice, params.endPrice, params.targetPrice);
    const range = maxPrice - minPrice;
    
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const currentPrice = minPrice + (range * i) / steps;
      const triggeredOrders = orders.filter(o => params.startPrice <= params.endPrice ? o.buyPrice <= currentPrice : o.buyPrice >= currentPrice);
      const totalCoinsOwned = triggeredOrders.reduce((sum, o) => sum + o.coinAmount, 0);
      const investedSoFar = triggeredOrders.reduce((sum, o) => sum + o.investAmount, 0);
      
      const profitSoFar = triggeredOrders.reduce((sum, o) => {
        return params.positionType === "long" 
          ? o.coinAmount * (currentPrice - o.buyPrice)
          : o.coinAmount * (o.buyPrice - currentPrice);
      }, 0);
      
      const currentPortfolioValue = investedSoFar + profitSoFar;
      
      data.push({
        price: currentPrice,
        portfolioValue: currentPortfolioValue,
        invested: investedSoFar,
      });
    }
    return data;
  }, [params.startPrice, params.endPrice, params.targetPrice, params.positionType, orders]);

  const entryPoints = orders.map(o => ({
    price: o.buyPrice,
    value: o.buyPrice * orders.filter(ord => (params.startPrice <= params.endPrice ? ord.buyPrice <= o.buyPrice : ord.buyPrice >= o.buyPrice)).reduce((s, ord) => s + ord.coinAmount, 0),
    amount: o.investAmount
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Target className="text-blue-600 w-6 h-6" />
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Máy tính DCA Nâng cao</h1>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Cột trái: Cài đặt thông số */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-sm border border-indigo-100 p-5">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3 text-indigo-900">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Phân tích Biểu đồ
            </h2>
            <p className="text-sm text-indigo-700/80 mb-4">
              Tải lên ảnh biểu đồ để AI tự động phân tích và đưa ra thông số khuyến nghị (Giá vào, chốt lời).
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Tải ảnh biểu đồ lên
                </>
              )}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Settings2 className="w-5 h-5 text-slate-500" />
              Thông số chiến lược
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vị thế (Long/Short)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={cn(
                      "py-2 px-3 text-sm font-medium rounded-lg border transition-colors",
                      params.positionType === "long" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                    onClick={() => handleParamChange("positionType", "long")}
                  >
                    Long
                  </button>
                  <button
                    className={cn(
                      "py-2 px-3 text-sm font-medium rounded-lg border transition-colors",
                      params.positionType === "short" 
                        ? "bg-rose-50 text-rose-700 border-rose-200" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                    onClick={() => handleParamChange("positionType", "short")}
                  >
                    Short
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Đòn bẩy (Leverage)</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                  value={params.leverage}
                  onChange={(e) => handleParamChange("leverage", parseInt(e.target.value) || 1)}
                >
                  <option value="1">1x (Spot)</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                  <option value="20">20x</option>
                  <option value="30">30x</option>
                  <option value="50">50x</option>
                  <option value="100">100x</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá bắt đầu (USD)</label>
                <input 
                  type="number" 
                  step="0.0001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={params.startPrice}
                  onChange={(e) => handleParamChange("startPrice", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá kết thúc vùng mua (USD)</label>
                <input 
                  type="number" 
                  step="0.0001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={params.endPrice}
                  onChange={(e) => handleParamChange("endPrice", parseFloat(e.target.value) || 0)}
                />
                {params.positionType === "long" && params.endPrice > params.targetPrice && (
                  <p className="text-xs text-amber-600 mt-1">Sẽ được tự động điều chỉnh bằng Giá chốt lời để đảm bảo lệnh cuối không lỗ.</p>
                )}
                {params.positionType === "short" && params.endPrice < params.targetPrice && (
                  <p className="text-xs text-amber-600 mt-1">Sẽ được tự động điều chỉnh bằng Giá chốt lời để đảm bảo lệnh cuối không lỗ.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá chốt lời (Target - USD)</label>
                <input 
                  type="number" 
                  step="0.0001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={params.targetPrice}
                  onChange={(e) => handleParamChange("targetPrice", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng lệnh</label>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={params.numberOfOrders}
                  onChange={(e) => handleParamChange("numberOfOrders", parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tổng vốn đầu tư (USD)</label>
                <input 
                  type="number" 
                  step="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={params.totalInvestment}
                  onChange={(e) => handleParamChange("totalInvestment", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kiểu phân bổ vùng giá</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                  value={params.spacingStrategy}
                  onChange={(e) => handleParamChange("spacingStrategy", e.target.value as SpacingStrategy)}
                >
                  <option value="linear">Tuyến tính (Chia đều khoảng giá)</option>
                  <option value="fibonacci">Fibonacci (Khoảng cách tăng dần)</option>
                  <option value="martingale">Martingale (Khoảng cách cấp số nhân)</option>
                  <option value="custom">DCA Tùy chỉnh (Đường cong lũy thừa)</option>
                </select>
              </div>

              {params.spacingStrategy === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hệ số đường cong ({params.customExponent})
                  </label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="5" 
                    step="0.1"
                    className="w-full accent-blue-600"
                    value={params.customExponent}
                    onChange={(e) => handleParamChange("customExponent", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-slate-500 mt-1">Hệ số càng cao, các lệnh càng tập trung gần giá bắt đầu.</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-1">Chiến lược phân bổ vốn</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                  value={params.volumeStrategy}
                  onChange={(e) => handleParamChange("volumeStrategy", e.target.value as any)}
                >
                  <option value="equal_target">Giá trị chốt lời bằng nhau (An toàn)</option>
                  <option value="equal_margin">Chia đều vốn mỗi lệnh (Trung bình)</option>
                  <option value="martingale">Martingale - Gấp thếp vốn (Rủi ro cao)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Chọn Martingale để kéo giá vốn trung bình về sát giá kết thúc.
                </p>
              </div>

              {params.volumeStrategy === "martingale" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hệ số nhân vốn ({params.volumeMultiplier}x)
                  </label>
                  <input 
                    type="range" 
                    min="1.1" 
                    max="5.0" 
                    step="0.1"
                    className="w-full accent-blue-600"
                    value={params.volumeMultiplier}
                    onChange={(e) => handleParamChange("volumeMultiplier", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lệnh sau sẽ lớn gấp {params.volumeMultiplier} lần lệnh trước.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-md p-6 text-white">
            <h3 className="text-blue-100 font-medium mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" /> Tổng kết kỳ vọng
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-blue-500/50 pb-2">
                <span className="text-sm text-blue-100">Tổng vốn bỏ ra</span>
                <span className="text-xl font-bold">{formatCurrency(totalInvested)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-blue-500/50 pb-2">
                <span className="text-sm text-blue-100">Giá vốn trung bình / Hòa vốn</span>
                <span className="text-lg font-semibold">{formatCurrency(avgEntryPrice)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-blue-500/50 pb-2">
                <span className="text-sm text-blue-100">Giá trị khi đạt Target</span>
                <span className="text-xl font-bold text-emerald-300">{formatCurrency(totalTargetValue)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-blue-500/50 pb-2">
                <span className="text-sm text-blue-100">Tổng lợi nhuận</span>
                <span className="text-xl font-bold text-emerald-400">+{formatCurrency(totalProfit)}</span>
              </div>
              <div className="flex justify-between items-end pt-1">
                <span className="text-sm text-blue-100">ROI dự kiến</span>
                <span className="text-2xl font-black text-white">{roi.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Mức giảm tối đa</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{maxDrawdownPercent.toFixed(2)}%</p>
              <p className="text-xs text-slate-500 mt-1">Từ giá vốn TB xuống giá lệnh cuối</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Khoảng an toàn</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{safetyMargin.toFixed(2)}%</p>
              <p className="text-xs text-slate-500 mt-1">Từ lệnh cuối lên tới Target</p>
            </div>
          </div>
        </div>

        {/* Cột phải: Biểu đồ & Bảng lệnh */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Biểu đồ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[400px] flex flex-col">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <LineChartIcon className="w-5 h-5 text-slate-500" />
              Biểu đồ giá trị danh mục theo giá trị đồng coin
            </h2>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="price" 
                    type="number" 
                    domain={['dataMin', 'dataMax']} 
                    tickFormatter={(val) => `$${val.toFixed(3)}`}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#64748b"
                    tickFormatter={(val) => `$${val}`}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrency(value), name === 'portfolioValue' ? 'Giá trị danh mục' : 'Đã đầu tư']}
                    labelFormatter={(label: number) => `Giá thị trường: ${formatCurrency(label)}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine x={params.targetPrice} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'Chốt lời', fill: '#10b981', fontSize: 12 }} />
                  <ReferenceLine x={avgEntryPrice} stroke="#8b5cf6" strokeDasharray="3 3" label={{ position: 'top', value: 'Hòa vốn', fill: '#8b5cf6', fontSize: 12 }} />
                  
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="portfolioValue" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    dot={false}
                    name="portfolioValue"
                  />
                  
                  <Scatter 
                    yAxisId="left"
                    data={entryPoints} 
                    fill="#f59e0b" 
                    name="Điểm vào lệnh"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bảng chi tiết lệnh */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-slate-500" />
                Chi tiết các lệnh mua
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">STT</th>
                    <th className="px-4 py-3 font-medium">Giá mua</th>
                    <th className="px-4 py-3 font-medium">Ký quỹ (Margin)</th>
                    <th className="px-4 py-3 font-medium">Quy mô (Position)</th>
                    <th className="px-4 py-3 font-medium">Số lượng Coin</th>
                    <th className="px-4 py-3 font-medium">Giá trị @ Target</th>
                    <th className="px-4 py-3 font-medium text-right">Lợi nhuận</th>
                    <th className="px-4 py-3 font-medium text-right">ROI (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">#{order.id}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(order.buyPrice)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(order.investAmount)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(order.positionSize)}</td>
                      <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatNumber(order.coinAmount, 6)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(order.targetValue)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">+{formatCurrency(order.profit)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{order.roi.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Điều chỉnh thông số để xem kế hoạch vào lệnh.
                      </td>
                    </tr>
                  )}
                </tbody>
                {orders.length > 0 && (
                  <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-4 py-4" colSpan={2}>TỔNG CỘNG</td>
                      <td className="px-4 py-4">{formatCurrency(totalInvested)}</td>
                      <td className="px-4 py-4">{formatCurrency(totalPositionSize)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700">{formatNumber(totalCoins, 6)}</td>
                      <td className="px-4 py-4 text-emerald-600">{formatCurrency(totalTargetValue)}</td>
                      <td className="px-4 py-4 text-emerald-600 text-right">+{formatCurrency(totalProfit)}</td>
                      <td className="px-4 py-4 text-emerald-600 text-right">{roi.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
