import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  MOVIE_FAN_S_B_T_ADDRESS,
  MOVIE_FAN_S_B_T_ABI,
} from "@/app/contracts/movieFanSBT";

export async function POST(request: NextRequest) {
  try {
    const { fanAddress, hcaptchaToken } = await request.json();

    // 验证地址格式
    if (!fanAddress || !ethers.isAddress(fanAddress)) {
      return NextResponse.json(
        { error: "Invalid fan address" },
        { status: 400 }
      );
    }

    if (!hcaptchaToken || typeof hcaptchaToken !== "string") {
      return NextResponse.json(
        { error: "Missing hCaptcha verification" },
        { status: 400 }
      );
    }

    const hcaptchaSecret = process.env.HCAPTCHA_SECRET;
    if (!hcaptchaSecret) {
      console.error("HCAPTCHA_SECRET not configured in environment");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    type HCaptchaVerifyResponse = {
      success: boolean;
      challenge_ts?: string;
      hostname?: string;
      credit?: boolean;
      "error-codes"?: string[];
    };

    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const verificationPayload = new URLSearchParams({
      secret: hcaptchaSecret,
      response: hcaptchaToken,
    });

    if (remoteIp) {
      verificationPayload.append("remoteip", remoteIp);
    }

    const verificationResponse = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verificationPayload,
    });

    if (!verificationResponse.ok) {
      console.error("hCaptcha verification request failed", verificationResponse.status);
      return NextResponse.json(
        { error: "Failed to verify hCaptcha" },
        { status: 502 }
      );
    }

    const verificationData = (await verificationResponse.json()) as HCaptchaVerifyResponse;

    if (!verificationData.success) {
      return NextResponse.json(
        {
          error: "hCaptcha verification failed",
          details: verificationData["error-codes"] ?? [],
        },
        { status: 400 }
      );
    }

    // 从环境变量获取私钥
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error("PRIVATE_KEY not configured in environment");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 连接到本地节点 (anvil)
    const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 创建钱包实例
    const wallet = new ethers.Wallet(privateKey, provider);

    // 创建合约实例
    const contract = new ethers.Contract(
      MOVIE_FAN_S_B_T_ADDRESS,
      MOVIE_FAN_S_B_T_ABI,
      wallet
    );

    // 检查用户是否已经拥有SBT
    const hasSBT = await contract.isMovieFan(fanAddress);
    if (hasSBT) {
      return NextResponse.json(
        { error: "SBT already minted for this address" },
        { status: 400 }
      );
    }

    // 调用mintSBT函数
    const tx = await contract.mintSBT(fanAddress);

    // 等待交易确认
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error: any) {
    console.error("Error minting SBT:", error);

    // 处理不同类型的错误
    let errorMessage = "Failed to mint SBT";
    let statusCode = 500;

    if (error.code === "CALL_EXCEPTION") {
      errorMessage = "Contract call failed: " + (error.reason || error.message);
      statusCode = 400;
    } else if (error.message?.includes("already minted")) {
      errorMessage = "SBT already minted for this address";
      statusCode = 400;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message,
      },
      { status: statusCode }
    );
  }
}
