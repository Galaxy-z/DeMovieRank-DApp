# SBT Mint 后端中继器

## 概述

SBT (Soulbound Token) mint功能已改为后端中继器模式，由服务器使用配置的私钥调用合约，用户无需支付gas费用。

## 配置

在 `.env` 文件中配置以下环境变量：

```properties
# 用于mint SBT的私钥（合约owner地址的私钥）
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# RPC节点地址（可选，默认为http://127.0.0.1:8545）
RPC_URL=http://127.0.0.1:8545
```

## API端点

### POST `/api/search/sponsor/sbt/mint`

为指定地址mint一个MovieFan SBT。

**请求体：**
```json
{
  "fanAddress": "0x..."
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockNumber": 12345
}
```

**错误响应：**
```json
{
  "error": "错误信息",
  "details": "详细错误信息"
}
```

## 工作流程

1. 用户在前端点击"领取电影粉丝SBT"按钮
2. 前端发送POST请求到 `/api/search/sponsor/sbt/mint`，包含用户地址
3. 后端使用配置的PRIVATE_KEY创建钱包实例
4. 后端检查用户是否已拥有SBT
5. 后端调用合约的 `mintSBT` 函数
6. 等待交易确认并返回结果
7. 前端刷新用户的SBT状态

## 优势

- **Gas费赞助**：用户无需支付gas费用
- **简化流程**：用户无需签名交易
- **更好的控制**：后端可以添加额外的验证逻辑
- **错误处理**：集中的错误处理和日志记录

## 安全注意事项

⚠️ **重要**：
- 请确保 `.env` 文件不会被提交到版本控制
- 在生产环境中使用专门的赞助钱包，不要使用主钱包
- 考虑添加速率限制以防止滥用
- 建议添加用户验证机制（如captcha）

## 测试

确保anvil本地节点正在运行：
```bash
anvil
```

然后访问应用并测试SBT领取功能。
