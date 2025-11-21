"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import type { ComponentRef } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { SearchModal } from "./SearchModal";
import { UserProfile } from "./UserProfile";
import { MOVIE_FAN_S_B_T_CONTRACT } from "../contracts/movieFanSBT";
import Link from "next/link";

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const HCAPTCHA_SITEKEY =
  process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY ?? "95f88ab2-3bd2-4130-8aa0-62a0b79e2c6c";

export function NavBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // 防止 hydration mismatch：仅在客户端挂载后再渲染依赖钱包状态的差异部分
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const preferredConnector = useMemo(() => connectors?.[0], [connectors]);
  const connectLabel = isPending ? "连接中..." : "连接钱包";

  const [searchOpen, setSearchOpen] = useState(false);
  const [mintStatus, setMintStatus] = useState<"idle" | "signing" | "success" | "error">("idle");
  const [mintError, setMintError] = useState<string | null>(null);
  const captchaRef = useRef<ComponentRef<typeof HCaptcha>>(null);

  const fanAddress = address ?? "0x0000000000000000000000000000000000000000";

  const {
    data: isFan,
    isFetching: isFanLoading,
    refetch: refetchIsFan,
  } = useReadContract({
    ...MOVIE_FAN_S_B_T_CONTRACT,
    functionName: "isMovieFan",
    args: [fanAddress],
    query: {
      enabled: mounted && !!address,
    },
  });

  const {
    data: fanProfile,
    isFetching: profileLoading,
    refetch: refetchProfile,
  } = useReadContract({
    ...MOVIE_FAN_S_B_T_CONTRACT,
    functionName: "getProfile",
    args: [fanAddress],
    query: {
      enabled: mounted && !!address && isFan === true,
    },
  });

  const submitMint = useCallback(
    async (token: string) => {
      if (!address) {
        setMintError("未检测到有效的钱包地址");
        setMintStatus("error");
        captchaRef.current?.resetCaptcha?.();
        return;
      }

      try {
        const response = await fetch("/api/search/sponsor/sbt/mint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fanAddress: address, hcaptchaToken: token }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "领取失败");
        }

        setMintStatus("success");
        await refetchIsFan();
        await refetchProfile();
      } catch (error) {
        const message = (error as { shortMessage?: string; message?: string })?.shortMessage;
        setMintError(message || (error as Error)?.message || "领取失败，请重试");
        setMintStatus("error");
      } finally {
        captchaRef.current?.resetCaptcha?.();
      }
    },
    [address, refetchIsFan, refetchProfile]
  );

  const handleCaptchaVerify = useCallback(
    async (token: string) => {
      if (!token) {
        setMintError("验证码验证失败，请重试");
        setMintStatus("error");
        captchaRef.current?.resetCaptcha?.();
        return;
      }

      await submitMint(token);
    },
    [submitMint]
  );

  const handleCaptchaError = useCallback(() => {
    setMintError("验证码加载失败，请重试");
    setMintStatus("error");
    captchaRef.current?.resetCaptcha?.();
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setMintError("验证码已过期，请重试");
    setMintStatus("idle");
    captchaRef.current?.resetCaptcha?.();
  }, []);

  const handleMintSBT = async () => {
    if (!address || mintStatus === "signing") return;

    setMintError(null);

    if (!captchaRef.current) {
      setMintError("验证码尚未加载完成，请稍后再试");
      setMintStatus("error");
      return;
    }

    setMintStatus("signing");

    try {
      await captchaRef.current.execute?.();
    } catch (error) {
      console.error("Failed to execute hCaptcha:", error);
      setMintError("验证码启动失败，请刷新后重试");
      setMintStatus("error");
      captchaRef.current?.resetCaptcha?.();
    }
  };

  // 当钱包地址切换时，重置领取状态，避免前一个账户的 "领取成功" 残留导致当前账户按钮不可用
  useEffect(() => {
    setMintStatus("idle");
    setMintError(null);
    // 重置验证码，确保新地址重新验证
    captchaRef.current?.resetCaptcha?.();
  }, [address]);

  // 当 isFan 结果返回后，如果显示当前地址不是粉丝但状态仍是 success（可能是前一个地址残留），复位为 idle
  useEffect(() => {
    if (isFan === false && mintStatus === "success") {
      setMintStatus("idle");
    }
    // 如果已经是粉丝，则不需要持有 success 状态（按钮会被替换成资料卡片）
    if (isFan === true && mintStatus !== "idle") {
      setMintStatus("idle");
    }
  }, [isFan, mintStatus]);

  const renderSBTSection = () => {
    if (!mounted || !isConnected || !address) return null;

    if (isFanLoading) {
      return <span className="text-xs text-gray-300">检查粉丝身份...</span>;
    }

    if (isFan === true) {
      return <UserProfile profile={fanProfile as any} isLoading={profileLoading} />;
    }

    return (
      <div className="flex flex-col items-end gap-1 text-right text-xs text-white/80">
        <HCaptcha
          ref={captchaRef}
          sitekey={HCAPTCHA_SITEKEY}
          size="invisible"
          onVerify={handleCaptchaVerify}
          onError={handleCaptchaError}
          onExpire={handleCaptchaExpire}
        />
        <button
          type="button"
          onClick={handleMintSBT}
          disabled={mintStatus === "signing" || mintStatus === "success"}
          className="rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-400"
        >
          {mintStatus === "signing"
            ? "正在领取..."
            : mintStatus === "success"
              ? "领取成功"
              : "领取电影粉丝SBT"}
        </button>
        {mintError && <span className="text-red-300">{mintError}</span>}
      </div>
    );
  };

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center border-b border-white/5 bg-slate-950/80 px-6 py-4 text-white backdrop-blur-md transition-all">
        <Link href="/" className="mr-8 flex items-center gap-2 transition hover:opacity-80">
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-purple-500 bg-clip-text text-transparent">
            DeMovieRank
          </span>
        </Link>

        {/* 居中的搜索触发器：absolute 定位 */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="pointer-events-auto group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white hover:border-white/20"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>搜索电影</span>
            <span className="hidden lg:inline text-xs text-slate-500 group-hover:text-slate-400">Ctrl+K</span>
          </button>
        </div>

        {/* 移动端图标 */}
        <button
          type="button"
          aria-label="搜索"
          onClick={() => setSearchOpen(true)}
          className="md:hidden rounded-full bg-white/5 p-2 text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        <div className="ml-auto flex min-h-[40px] flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
          {renderSBTSection()}
          {!mounted ? (
            <button
              aria-hidden
              className="rounded-full bg-sky-600/50 px-5 py-2 text-sm font-semibold text-white opacity-70"
            >
              连接钱包
            </button>
          ) : isConnected && address ? (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end text-xs sm:flex">
                <span className="font-medium text-slate-200">已连接</span>
                <span className="text-slate-500 font-mono">{shortenAddress(address)}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500 hover:text-white"
              >
                断开
              </button>
            </div>
          ) : (
            <button
              onClick={() => preferredConnector && connect({ connector: preferredConnector })}
              disabled={!preferredConnector || isPending}
              className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:shadow-sky-500/40 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectLabel}
            </button>
          )}
        </div>
      </nav>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
