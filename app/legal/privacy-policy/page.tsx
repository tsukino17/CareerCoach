import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '用户协议与隐私政策 | EchoTalent',
  description: 'EchoTalent 用户协议与隐私政策说明',
};

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  const updatedAt = '2026-05-06';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 md:p-10">
        <header className="border-b border-slate-100 pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">用户协议与隐私政策</h1>
          <p className="mt-2 text-sm text-slate-500">生效日期：{updatedAt}</p>
        </header>

        <section className="mt-6 space-y-6 text-sm leading-7 text-slate-700">
          <p>
            欢迎使用 EchoTalent（以下简称“本平台”）。本文件用于说明你在使用本平台时的权利义务，以及我们如何收集、使用、存储与保护你的个人信息和对话数据。
            你在注册、登录或继续使用本平台前，请仔细阅读本文件。
          </p>

          <Block title="一、适用范围">
            本政策适用于你通过网页、移动端或其他方式使用 EchoTalent 提供的职业探索、对话教练、报告生成及相关功能。
          </Block>

          <Block title="二、我们收集的信息">
            <ul className="list-disc pl-5 space-y-1">
              <li>账号信息：邮箱地址、登录状态信息。</li>
              <li>资料信息：昵称、头像样式、协议同意记录等。</li>
              <li>对话与内容数据：你主动输入的文本、语音转写文本、生成结果、会话标题与时间等。</li>
              <li>设备与日志信息：访问时间、页面路径、浏览器类型、错误日志、基础行为埋点。</li>
            </ul>
          </Block>

          <Block title="三、信息使用目的">
            <ul className="list-disc pl-5 space-y-1">
              <li>用于账号登录验证、身份识别和安全风控。</li>
              <li>用于提供和优化核心服务，包括对话体验、报告质量、稳定性和故障排查。</li>
              <li>用于产品分析与运营，包括访问量、关键步骤转化、功能改进。</li>
              <li>在脱敏、去标识化和保密控制前提下，可能用于模型训练与能力优化。</li>
            </ul>
          </Block>

          <Block title="四、关于对话数据与模型训练">
            <ul className="list-disc pl-5 space-y-1">
              <li>我们会尽量采用脱敏与最小必要原则处理训练样本，避免直接暴露可识别个人身份的信息。</li>
              <li>训练和分析仅用于提升产品能力，不会用于与你无关的个体画像贩售或非法用途。</li>
              <li>你可以通过联系平台运营方申请删除账号与相关数据（法律法规另有规定的除外）。</li>
            </ul>
          </Block>

          <Block title="五、信息共享与披露">
            <ul className="list-disc pl-5 space-y-1">
              <li>未经你同意，我们不会向无关第三方出售你的个人信息。</li>
              <li>我们可能使用受信任的云服务、模型服务或基础设施服务商来提供功能，但会要求其履行保密义务。</li>
              <li>在法律法规要求、司法或行政机关依法要求的情况下，我们可能依法披露必要信息。</li>
            </ul>
          </Block>

          <Block title="六、数据存储与安全保护">
            <ul className="list-disc pl-5 space-y-1">
              <li>我们采取访问控制、权限隔离、日志审计和传输加密等措施保护数据安全。</li>
              <li>管理员权限受白名单与鉴权控制，敏感数据接口限制非授权访问。</li>
              <li>尽管如此，互联网环境并非绝对安全，请妥善保管你的设备和邮箱账户。</li>
            </ul>
          </Block>

          <Block title="七、你的权利">
            <ul className="list-disc pl-5 space-y-1">
              <li>你有权访问、更正、更新你的账号与资料信息。</li>
              <li>你有权注销账号并要求删除相关数据（受法律法规和技术实现限制）。</li>
              <li>你有权对本政策提出疑问、建议或投诉。</li>
            </ul>
          </Block>

          <Block title="八、未成年人保护">
            若你为未成年人，请在监护人指导下阅读并同意本政策后再使用本平台。
          </Block>

          <Block title="九、政策更新">
            我们可能根据业务变化或法律要求更新本政策。重大变更将通过页面公告、邮件或其他合理方式提示你。
          </Block>

          <Block title="十、联系我们">
            如你对本政策有任何问题，可通过产品页面提供的联系方式与我们联系。
          </Block>
        </section>
      </article>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}
