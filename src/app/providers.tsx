'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { anvil } from 'viem/chains';

// 自定义本地 Foundry/Anvil 链，避免默认链不存在导致 injected 钱包报错
// export const foundryLocal = defineChain({
//   id: 31337,
//   name: 'Foundry Local',
//   network: 'foundry',
//   nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
//   rpcUrls: {
//     default: { http: ['http://127.0.0.1:8545'] },
//     public: { http: ['http://127.0.0.1:8545'] },
//   },
// });

export const config = createConfig({
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}