# GitHub Setup

这份说明用于把 GitHub 推送链路尽量变成一次配置、后面少折腾。

## 推荐方式

优先推荐 SSH，其次才是 `gh auth login`。

原因：

- SSH 配一次后，`git push` 更稳定
- 不依赖设备码登录
- 不容易反复卡在浏览器授权

## 方案一：SSH（推荐）

### 1. 检查本机是否已有 key

```bash
ls ~/.ssh
```

如果已经有类似这些文件：

- `id_rsa`
- `id_rsa.pub`
- `github_rsa`
- `github_rsa.pub`

可以优先复用。

### 2. 生成新 key（如果没有）

```bash
ssh-keygen -t ed25519 -C "your_github_email@example.com"
```

### 3. 把公钥加到 GitHub

查看公钥：

```bash
cat ~/.ssh/id_ed25519.pub
```

复制内容，添加到 GitHub：

- GitHub
- Settings
- SSH and GPG keys
- New SSH key

### 4. 测试 SSH

```bash
ssh -T git@github.com
```

如果成功，会看到 GitHub 的欢迎提示。

### 5. 把仓库 remote 改成 SSH

```bash
git remote set-url origin git@github.com:tsukino17/CareerCoach.git
```

以后推送直接：

```bash
git push
```

## 方案二：GitHub CLI

如果你还是想用 HTTPS，可以先做一次完整配置：

```bash
gh auth login
gh auth setup-git
```

完成后检查：

```bash
gh auth status
```

但这套方式更容易受终端、设备码、浏览器登录态影响。

## 项目推荐结论

对这个项目，后续最省事的做法是：

1. 把 `origin` 永久改成 SSH
2. 以后统一走：
   - `git push`
   - GitHub PR
   - merge to `main`
   - Vercel 自动部署

## 每次上线前的最短 Git 流程

```bash
git checkout -b feature/your-change
git add .
git commit -m "feat: your change"
git push -u origin feature/your-change
```

然后在 GitHub 提 PR 到 `main`。

## 如果又遇到 push 失败

先看是哪一类：

### 如果报认证问题

- 优先检查 remote 是不是 SSH
- 再检查 `ssh -T git@github.com`

### 如果报 conflict

- 去 GitHub 上解决冲突
- 不要在脏工作区里硬合

### 如果报权限问题

- 检查当前 GitHub 账号是否对该仓库有 push 权限
