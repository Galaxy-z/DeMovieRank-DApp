// app/page.tsx
'use client';

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract } from 'wagmi';
import { useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { config } from './providers';

// 你部署的合约ABI（简化版）
const MOVIERATING_ABI = [{"type":"function","name":"getAverageRating","inputs":[{"name":"_movieId","type":"string","internalType":"string"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"rateMovie","inputs":[{"name":"_movieId","type":"string","internalType":"string"},{"name":"_rating","type":"uint8","internalType":"uint8"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"ratingsByMovie","inputs":[{"name":"","type":"string","internalType":"string"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"event","name":"NewRating","inputs":[{"name":"user","type":"address","indexed":true,"internalType":"address"},{"name":"movieId","type":"string","indexed":false,"internalType":"string"},{"name":"rating","type":"uint8","indexed":false,"internalType":"uint8"}],"anonymous":false}]; // 这里需要从你的合约编译产物(artifacts)中复制ABI
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // 替换成你的合约地址

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const [txStatus, setTxStatus] = useState<'idle'|'pending'|'submitted'|'success'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [movieId, setMovieId] = useState('');
  const [rating, setRating] = useState(5);

  // 读取平均评分
  const { data: avgRating, refetch, isLoading: avgLoading } = useReadContract({
    abi: MOVIERATING_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'getAverageRating',
    args: [movieId || 'placeholder'], // 防止空字符串导致 viem 参数编码报错
    query: {
      enabled: !!movieId, // 只有输入了 movieId 才查询
    },
  });

  // 提交评分
  const handleRate = async () => {
    setErrorMsg('');
    if (!movieId) {
      setErrorMsg('请先输入电影 ID');
      return;
    }
    try {
      // pending: 等待用户在钱包里签名
      setTxStatus('pending');
      const hash = await writeContractAsync({
        abi: MOVIERATING_ABI,
        address: CONTRACT_ADDRESS,
        functionName: 'rateMovie',
        args: [movieId, rating],
      });
      // submitted: 用户已签名，交易已发送，等待上链确认
      setTxStatus('submitted');
      await waitForTransactionReceipt(config, { hash });
      // success: 交易已确认
      setTxStatus('success');
      refetch();
    } catch (e: any) {
      setTxStatus('error');
      setErrorMsg(e?.shortMessage || e?.message || '交易失败');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">去中心化电影评分</h1>
      {!isConnected ? (
        <button onClick={() => connect({ connector: connectors[0] })} className="bg-blue-500 text-white p-2 rounded">连接钱包</button>
      ) : (
        <div>
          <p>已连接: {address}</p>
          <button onClick={() => disconnect()} className="bg-red-500 text-white p-2 rounded">断开连接</button>
          
          <div className="mt-4">
            <input 
              type="text" 
              placeholder="输入电影ID (如: tt1234567)" 
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              className="border p-2 mr-2"
            />
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="border p-2">
              {[1,2,3,4,5,6,7,8,9,10].map(num => <option key={num} value={num}>{num}</option>)}
            </select>
            <button onClick={handleRate} className="bg-green-500 text-white p-2 rounded ml-2">评分</button>
            {txStatus === 'pending' && <span className="ml-2 text-yellow-600">等待签名...</span>}
            {txStatus === 'submitted' && <span className="ml-2 text-yellow-600">等待确认...</span>}
            {txStatus === 'success' && <span className="ml-2 text-green-600">成功 ✅</span>}
            {txStatus === 'error' && <span className="ml-2 text-red-600">失败 ❌</span>}
          </div>
          {errorMsg && <p className="text-red-600 mt-2">{errorMsg}</p>}
          {movieId && (
            <div className="mt-4">
              <p>电影 "{movieId}" 的平均评分: {avgLoading ? '加载中...' : (avgRating?.toString() || '暂无')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}