# Changelog

## v1.0.2

- 自托管更新改为从 Git 获取正式版源码，在 Docker 内安装依赖并构建；宿主机只需 Docker 和 Git。
- 基础环境由 `docker/Dockerfile.source` 决定，仅该文件变化时发布新的 `tukeceshi/z3cz-runtime` 镜像。
- 旧机器须先安装包含 `SOURCE_REVISION` 的新版部署包，再运行 `deploy.sh` 完成一次源码部署迁移。

## v1.0.0

- 自托管支持正式版本号与后台在线更新：检查 GitHub Release、备份数据库与上传文件、切换镜像、健康验证失败自动回退。
- 运行中的 api/app 镜像固定到发布版本，不再用 `latest` 作为升级依据。
- 宿主机更新器改为独立二进制（SHA-256 校验），`deploy.sh` 会自动安装；升级时校验镜像摘要、刷新宿主机脚本，并在健康通过后自更新更新器。
- 首次安装仍可用部署包；部署完成后即可在管理后台「系统更新」升级。
