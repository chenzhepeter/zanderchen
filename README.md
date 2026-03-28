# Zander Chen — GitHub Pages

个人主页静态站点，展示项目与兴趣。

## 发布到 GitHub Pages

1. 将本仓库推送到 GitHub（用户主页可使用仓库名 `用户名.github.io`，项目主页可使用任意仓库名）。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment**：Source 选择 **Deploy from a branch**，Branch 选 **main**，文件夹选 **/ (root)**，保存。

几分钟后即可通过 `https://<用户名>.github.io` 或 `https://<用户名>.github.io/<仓库名>/` 访问（视仓库类型而定）。

## 修改内容

- 编辑 `index.html` 中的文案、项目卡片与兴趣标签。
- 样式在 `styles.css`；字体通过 Google Fonts 在 `index.html` 中引入。

## 本地预览

在项目根目录执行：

```bash
python3 -m http.server 8080
```

浏览器打开 <http://127.0.0.1:8080>。
