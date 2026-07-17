# Supabase Authentication 邮件模板（EchoTalent 风格）

以下模板适用于 Supabase `Authentication -> Email Templates`。

统一视觉风格：
- 清新浅色背景
- 简洁标题与正文
- 单一主按钮
- 兜底纯文本链接

使用方式：
1. 进入 Supabase 控制台 `Authentication -> Email Templates`
2. 选择对应模板类型
3. 填 `Subject`
4. 粘贴对应 `HTML`

---

## 1) Confirm sign up

**Subject**
```text
欢迎加入 EchoTalent，验证你的邮箱
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">欢迎来到 EchoTalent</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">很高兴见到你。点击下方按钮验证邮箱，开始你的职业探索之旅。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">验证我的邮箱</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2) Invite user

**Subject**
```text
你收到一封 EchoTalent 邀请邮件
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">你被邀请加入 EchoTalent</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">点击按钮完成注册，开始你的天赋探索与职业成长。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">接受邀请并注册</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3) Magic link

**Subject**
```text
你的 EchoTalent 登录链接
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">一键登录 EchoTalent</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">点击下方按钮即可登录。本链接仅限本次使用，请勿转发。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">立即登录</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

> 重要：如果你希望过期/无效链接也回到站内友好错误页，不要在 Magic link 模板里直接使用 `{{ .ConfirmationURL }}`。
> 建议把按钮链接改成你的站内 callback，并用 `token_hash` 让站内页面调用 `verifyOtp`。

**推荐链接格式**
```html
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/admin&terms_accepted=1&training_consent=1&policy_version=v2026-05
```

如果不是管理员登录，把 `next=/admin` 改成你需要回跳的页面，例如 `next=/user` 或 `next=/chat`。

---

## 4) Change email address

**Subject**
```text
请确认你的新邮箱地址
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">确认新的邮箱地址</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">我们收到了你的邮箱修改请求。请点击按钮确认此操作。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">确认新邮箱</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 5) Reset password

**Subject**
```text
重置你的 EchoTalent 密码
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">重置密码</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">点击下方按钮重置密码。如果这不是你的操作，请忽略这封邮件。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">重置密码</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 6) Reauthentication

**Subject**
```text
请完成安全验证
```

**HTML**
```html
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8eefb;border-radius:18px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">请确认是你本人操作</td></tr>
            <tr><td style="height:12px;"></td></tr>
            <tr><td style="font-size:16px;line-height:1.8;color:#334155;">为了保护账号安全，请点击下方按钮完成本次身份确认。</td></tr>
            <tr><td style="height:22px;"></td></tr>
            <tr>
              <td>
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff8a4c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 22px;border-radius:12px;">确认身份</a>
              </td>
            </tr>
            <tr><td style="height:20px;"></td></tr>
            <tr><td style="font-size:13px;line-height:1.7;color:#64748b;">如果按钮无法点击，请复制下面链接到浏览器打开：</td></tr>
            <tr><td style="word-break:break-all;font-size:13px;line-height:1.7;color:#2563eb;">{{ .ConfirmationURL }}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 建议同时检查的配置

为避免 magic link 跑偏到旧地址，请确认：

1. `Site URL` 指向当前有效地址（本地调试建议 `http://localhost:3003`）
2. `Redirect URLs` 包含：
   - `http://localhost:3003/auth/callback`
   - 你的正式域名回调地址（如果有）
3. 前端环境变量：
   - `NEXT_PUBLIC_APP_URL=http://localhost:3003`（或正式域名）
