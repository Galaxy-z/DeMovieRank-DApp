'use client';
import { useEffect, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';

export function DebugPanel() {
  const { address } = useAccount();
  const config = useConfig();
  const [ethInfo, setEthInfo] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const w = (window as any).ethereum;
    if (w) {
      const info = {
        isMetaMask: !!w.isMetaMask,
        providersCount: Array.isArray(w.providers) ? w.providers.length : 0,
        chains: w.chainId,
      };
      setEthInfo(info);
    } else {
      setErrors((prev) => [...prev, 'window.ethereum 不存在']);
    }
  }, []);

  return (
    <div className="mt-6 p-3 border rounded text-xs bg-gray-50">
      <p className="font-semibold mb-2">调试面板</p>
      <pre className="whitespace-pre-wrap">account: {address || '未连接'}</pre>
      <pre className="whitespace-pre-wrap">wagmi chains: {config.chains.map(c=>c.id).join(', ')}</pre>
      <pre className="whitespace-pre-wrap">ethereum: {ethInfo ? JSON.stringify(ethInfo, null, 2) : '无'}</pre>
      {errors.length > 0 && <pre className="text-red-600">Errors: {errors.join('; ')}</pre>}
    </div>
  );
}
