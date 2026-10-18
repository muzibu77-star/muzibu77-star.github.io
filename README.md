# 个人项目主页

纯静态网站，无构建步骤，可直接部署到 GitHub Pages。

```
index.html        一页式主页：首屏 / 关于我 / 技能栈 / 项目经历（含视频）/ 工作经历 / 联系方式
assets/style.css  样式（自动跟随系统亮 / 暗色）
assets/site.js    视频章节跳转
assets/video/     演示视频（pet-demo 为原 4K 版转 1080p；finagent-demo 为原文件加 faststart）
assets/img/       视频封面；头像放 assets/img/avatar.jpg（正方形最佳），没有时显示“魏”字
```

## 部署到 GitHub Pages

1. 在 GitHub 新建一个公开仓库，仓库名填 `<你的用户名>.github.io`，网址就是 `https://<你的用户名>.github.io`。
2. 在本目录执行：

   ```bash
   git init
   git add .
   git commit -m "init personal site"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<你的用户名>.github.io.git
   git push -u origin main
   ```

3. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，分支选 `main`、目录 `/ (root)`，保存后一两分钟生效。

## 更新视频

把新视频转成网页版后覆盖 `assets/video/` 下同名文件即可：

```bash
ffmpeg -i 原视频.mp4 -vf "scale=1920:-2" -c:v libx264 -crf 22 -pix_fmt yuv420p -an -movflags +faststart assets/video/pet-demo.mp4
```

`-movflags +faststart` 让浏览器不用下载完整文件就能开始播放。
