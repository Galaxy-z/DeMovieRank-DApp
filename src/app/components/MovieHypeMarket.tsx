'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { formatEther, parseEther } from 'viem';

import { config } from '../providers';
import { MOVIE_HYPE_MARKET_CONTRACT, MOVIE_HYPE_MARKET_ADDRESS } from '../contracts/movieHypeMarket';
import { POPCORN_TOKEN_CONTRACT, POPCORN_TOKEN_ADDRESS } from '../contracts/popcornToken';

interface Props {
  movieId: string;
  className?: string;
}

export function MovieHypeMarket({ movieId, className }: Props) {
  const { address, isConnected } = useAccount();
  const [buyAmount, setBuyAmount] = useState<string>('1');
  const [sellAmount, setSellAmount] = useState<string>('1');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [refreshTick, setRefreshTick] = useState(0);

  // 1. 读取市场数据
  const { data: marketData, refetch: refetchMarket } = useReadContracts({
    contracts: [
      {
        ...MOVIE_HYPE_MARKET_CONTRACT,
        functionName: 'getMovieSupply',
        args: [movieId],
      },
      {
        ...MOVIE_HYPE_MARKET_CONTRACT,
        functionName: 'getBalance',
        args: [movieId, address ?? '0x0000000000000000000000000000000000000000'],
      },
      {
        ...MOVIE_HYPE_MARKET_CONTRACT,
        functionName: 'getUserPositionInfo',
        args: [movieId, address ?? '0x0000000000000000000000000000000000000000'],
      },
    ],
    query: {
      enabled: !!movieId,
    }
  });

  const [supply, userShares, positionInfo] = marketData?.map(r => r.result) || [0n, 0n, undefined];
  const [posValue, posCost, posPnL] = (positionInfo as [bigint, bigint, bigint]) || [0n, 0n, 0n];

  // 2. 读取价格预估
  const buyAmountBigInt = useMemo(() => {
    try {
      return BigInt(buyAmount || '0');
    } catch {
      return 0n;
    }
  }, [buyAmount]);

  const sellAmountBigInt = useMemo(() => {
    try {
      return BigInt(sellAmount || '0');
    } catch {
      return 0n;
    }
  }, [sellAmount]);

  const { data: estimatedBuyCost } = useReadContract({
    ...MOVIE_HYPE_MARKET_CONTRACT,
    functionName: 'getBuyPrice',
    args: [movieId, buyAmountBigInt],
    query: {
      enabled: buyAmountBigInt > 0n,
    }
  });

  const { data: estimatedSellReturn } = useReadContract({
    ...MOVIE_HYPE_MARKET_CONTRACT,
    functionName: 'getSellPrice',
    args: [movieId, sellAmountBigInt],
    query: {
      enabled: sellAmountBigInt > 0n,
    }
  });

  // 3. 读取代币授权和余额
  const { data: tokenData, refetch: refetchToken } = useReadContracts({
    contracts: [
      {
        ...POPCORN_TOKEN_CONTRACT,
        functionName: 'allowance',
        args: [address ?? '0x0000000000000000000000000000000000000000', MOVIE_HYPE_MARKET_ADDRESS],
      },
      {
        ...POPCORN_TOKEN_CONTRACT,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
      },
    ],
    query: {
      enabled: isConnected && !!address,
    }
  });

  const [allowance, tokenBalance] = tokenData?.map(r => r.result) || [0n, 0n];

  useEffect(() => {
    refetchMarket();
    refetchToken();
  }, [refreshTick, refetchMarket, refetchToken]);

  const handleBuy = async () => {
    if (!isConnected || !address) return;
    if (buyAmountBigInt <= 0n) return;
    
    setIsSubmitting(true);
    setTxMessage(null);
    setTxStatus('idle');

    try {
      if (estimatedBuyCost === undefined) {
         throw new Error('正在计算价格，请稍候...');
      }
      const cost = estimatedBuyCost as bigint;
      
      // 直接读取最新余额和授权，不依赖 hook 状态
      const currentBalance = await readContract(config, {
        ...POPCORN_TOKEN_CONTRACT,
        functionName: 'balanceOf',
        args: [address],
      });

      const currentAllowance = await readContract(config, {
        ...POPCORN_TOKEN_CONTRACT,
        functionName: 'allowance',
        args: [address, MOVIE_HYPE_MARKET_ADDRESS],
      });
      
      // 检查余额
      if (currentBalance < cost) {
        throw new Error(`Popcorn Token 余额不足 (余额: ${formatEther(currentBalance)}, 需要: ${formatEther(cost)})`);
      }

      // 检查授权
      if (currentAllowance < cost) {
        setTxMessage('正在请求代币授权...');
        const approveHash = await writeContract(config, {
          ...POPCORN_TOKEN_CONTRACT,
          functionName: 'approve',
          args: [MOVIE_HYPE_MARKET_ADDRESS, cost],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
        setTxMessage('授权成功，正在购买...');
        // 刷新授权数据
        await refetchToken();
      } else {
        setTxMessage('正在购买...');
      }

      const buyHash = await writeContract(config, {
        ...MOVIE_HYPE_MARKET_CONTRACT,
        functionName: 'buyShares',
        args: [movieId, buyAmountBigInt],
      });
      
      await waitForTransactionReceipt(config, { hash: buyHash });
      
      setTxStatus('success');
      setTxMessage(`成功购买 ${buyAmount} 份热度份额！`);
      setBuyAmount('1');
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      setTxMessage(err.shortMessage || err.message || '购买失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSell = async () => {
    if (!isConnected || !address) return;
    if (sellAmountBigInt <= 0n) return;

    setIsSubmitting(true);
    setTxMessage(null);
    setTxStatus('idle');

    try {
      if ((userShares as bigint) < sellAmountBigInt) {
        throw new Error('持有份额不足');
      }

      setTxMessage('正在卖出...');
      const sellHash = await writeContract(config, {
        ...MOVIE_HYPE_MARKET_CONTRACT,
        functionName: 'sellShares',
        args: [movieId, sellAmountBigInt],
      });

      await waitForTransactionReceipt(config, { hash: sellHash });

      setTxStatus('success');
      setTxMessage(`成功卖出 ${sellAmount} 份热度份额！`);
      setSellAmount('1');
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      setTxMessage(err.shortMessage || err.message || '卖出失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${className ?? ''}`.trim()}>
      <div className="glass-panel rounded-xl p-6 border border-white/10 bg-slate-900/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-purple-400">📈</span> 热度市场 (Hype Market)
          </h3>
          <div className="text-right">
            <div className="text-sm text-slate-400">当前热度 (总份额)</div>
            <div className="text-xl font-bold text-purple-400 font-mono">
              {supply ? supply.toString() : '0'}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'buy' 
                ? 'bg-purple-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            买入份额
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'sell' 
                ? 'bg-pink-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            卖出份额
          </button>
        </div>

        {/* 盈亏展示区域 */}
        {isConnected && (userShares as bigint) > 0n && (
          <div className="mb-6 grid grid-cols-3 gap-2 bg-slate-800/30 p-3 rounded-lg border border-white/5">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">持仓市值</div>
              <div className="text-sm font-mono text-white">
                {formatEther(posValue)} POP
              </div>
            </div>
            <div className="text-center border-l border-white/5">
              <div className="text-xs text-slate-400 mb-1">总成本</div>
              <div className="text-sm font-mono text-slate-300">
                {formatEther(posCost)} POP
              </div>
            </div>
            <div className="text-center border-l border-white/5">
              <div className="text-xs text-slate-400 mb-1">盈亏 (P&L)</div>
              <div className={`text-sm font-mono font-bold ${
                posPnL > 0n ? 'text-green-400' : posPnL < 0n ? 'text-red-400' : 'text-slate-300'
              }`}>
                {posPnL > 0n ? '+' : ''}{formatEther(posPnL)} POP
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {activeTab === 'buy' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  购买数量
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="flex justify-between text-sm p-3 bg-slate-800/30 rounded-lg">
                <span className="text-slate-400">预计花费:</span>
                <span className="font-mono text-purple-300">
                  {estimatedBuyCost ? formatEther(estimatedBuyCost as bigint) : '0'} POP
                </span>
              </div>
              <div className="text-right text-xs text-slate-500 px-1">
                余额: {tokenBalance ? formatEther(tokenBalance as bigint) : '0'} POP
              </div>

              <button
                onClick={handleBuy}
                disabled={!isConnected || isSubmitting || buyAmountBigInt <= 0n}
                className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition hover:shadow-purple-500/40 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? '交易处理中...' : '确认买入'}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    卖出数量
                  </label>
                  <span className="text-xs text-slate-400">
                    持有: {userShares ? userShares.toString() : '0'}
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={userShares ? userShares.toString() : undefined}
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex justify-between text-sm p-3 bg-slate-800/30 rounded-lg">
                <span className="text-slate-400">预计获得:</span>
                <span className="font-mono text-pink-300">
                  {estimatedSellReturn ? formatEther(estimatedSellReturn as bigint) : '0'} POP
                </span>
              </div>

              <button
                onClick={handleSell}
                disabled={!isConnected || isSubmitting || sellAmountBigInt <= 0n || (userShares as bigint) < sellAmountBigInt}
                className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition hover:shadow-pink-500/40 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? '交易处理中...' : '确认卖出'}
              </button>
            </div>
          )}

          {txMessage && (
            <div className={`text-center text-sm p-2 rounded ${
              txStatus === 'error' ? 'bg-red-500/10 text-red-400' : 
              txStatus === 'success' ? 'bg-green-500/10 text-green-400' : 
              'bg-blue-500/10 text-blue-400'
            }`}>
              {txMessage}
            </div>
          )}
          
          {!isConnected && (
            <div className="text-center text-xs text-slate-500">
              请先连接钱包参与热度市场交易
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
