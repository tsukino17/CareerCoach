// [RESERVED:payment] 充值/退款功能总开关（默认关闭）。
// 关闭时：相关页面与 API 不可达，入口隐藏；数据表与代码保持完整，便于后续重新启用。
// 注意：本文件同时被客户端组件引用，禁止引入 next/server 等仅服务端可用的模块。
const PAYMENT_DISABLED_BODY = {
  error: '充值功能未启用',
  code: 'payment_disabled',
};

export function isRechargeEnabled(): boolean {
  const flag =
    process.env.NEXT_PUBLIC_PAYMENT_RECHARGE_ENABLED ?? process.env.PAYMENT_RECHARGE_ENABLED;
  return flag === 'true';
}

/** API 统一关闭响应：503，语义明确，避免前端误判为业务失败 */
export function rechargeDisabledResponse(): Response {
  return new Response(JSON.stringify(PAYMENT_DISABLED_BODY), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
