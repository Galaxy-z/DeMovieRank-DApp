"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function NavBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // 防止 hydration mismatch：仅在客户端挂载后再渲染依赖钱包状态的差异部分
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const preferredConnector = useMemo(() => connectors?.[0], [connectors]);
  const connectLabel = isPending ? "连接中..." : "连接钱包";

  return (
    <nav className="flex items-center justify-between bg-gray-800 px-6 py-4 text-white">
      <h1 className="text-2xl font-bold">DeMovieRank</h1>
      <div className="flex items-center gap-3 min-h-[40px]">
        {/* 在还未 mounted 时渲染与服务端一致的占位（按钮），避免首屏结构差异 */}
        {!mounted ? (
          <button
            aria-hidden
            className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white opacity-70"
          >
            {"连接钱包"}
          </button>
        ) : isConnected && address ? (
          <>
            <span className="hidden text-sm text-gray-300 sm:inline">{shortenAddress(address)}</span>
            <button
              onClick={() => disconnect()}
              className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              断开连接
            </button>
          </>
        ) : (
            <button
                onClick={() => preferredConnector && connect({ connector: preferredConnector })}
                disabled={!preferredConnector || isPending}
                className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
                {connectLabel}
            </button>
        )}
      </div>
    </nav>
  );
}
