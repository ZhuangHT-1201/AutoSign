# 首次开源发布清单

## 仓库

- [ ] 创建公开 GitHub 仓库并确认默认分支名称。
- [ ] 添加仓库地址到 `package.json` 的 `repository`、`homepage` 与 `bugs` 字段。
- [ ] 启用 Issues、Discussions（可选）和私密安全报告。
- [ ] 启用 Dependabot 与 GitHub Actions。
- [ ] 检查仓库没有提交 `.env`、Cookie、个人课表、签名文件或构建产物。

## 版本

- [ ] 同步 `package.json`、`android/app/build.gradle` 和 `CHANGELOG.md` 中的版本号。
- [ ] 更新 Windows 安装包。
- [ ] 使用个人 Android 签名密钥生成并验证 release APK/AAB。
- [ ] 在 Windows 10/11 和至少一台 Android 真机上完成登录、课表、周次切换和签到测试。
- [ ] 离线测试课表快照与退出登录。
- [ ] 复核隐私文档与第三方许可。

## Git 标签

```bash
git tag -a v0.1.1 -m "课迹 0.1.1"
git push origin main
git push origin v0.1.1
```

标签推送后，仓库中的 Release workflow 会生成 Windows 安装包和 Android 调试 APK。正式 Android 发布包需要另行签名。

## 发布说明

说明本次功能、已知限制、支持的平台、安装方式以及校园服务可能变动的风险。不要附带任何真实用户数据。
