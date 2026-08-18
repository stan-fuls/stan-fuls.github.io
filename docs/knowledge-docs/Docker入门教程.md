---
permalink: /docs/knowledge-docs/Docker入门教程/
title: Docker入门教程
description: 从零开始学习 Docker 容器技术，涵盖核心概念、安装配置、镜像管理与容器操作全流程
category: 云计算
tags:
  - Docker
  - 容器
  - DevOps
author: Stam
date: 2026-08-15 16:53:33
toc: "true"
layout: doc
---
## 概述

Docker 是一个开源的容器化平台，它允许开发者将应用及其依赖打包到一个轻量级、可移植的容器中，然后在任何环境中一致地运行。自 2013 年发布以来，Docker 已成为容器技术的事实标准，深刻改变了软件的开发、测试和部署方式。

与传统虚拟机相比，Docker 容器不需要完整的操作系统，而是共享宿主机的内核，因此启动速度更快、资源占用更低。一个容器通常只需几秒即可启动，而虚拟机往往需要数十秒甚至更久。

## 核心内容

### 一、核心概念

#### 1. 镜像（Image）

镜像是容器的只读模板，包含了运行应用所需的所有内容——代码、运行时、库、环境变量和配置文件。

```bash
# 查看本地镜像
docker images

# 拉取官方镜像
docker pull nginx:latest

# 删除镜像
docker rmi nginx:latest
```

#### 2. 容器（Container）

容器是镜像的运行实例。你可以启动、停止、删除容器，每个容器都是相互隔离的。

```bash
# 从镜像启动容器
docker run -d --name my-nginx -p 8080:80 nginx:latest

# 查看运行中的容器
docker ps

# 查看所有容器（包括已停止）
docker ps -a

# 停止/启动/删除容器
docker stop my-nginx
docker start my-nginx
docker rm my-nginx
```

#### 3. 仓库（Registry）

仓库是存储和分发镜像的服务。Docker Hub 是最大的公共仓库，你也可以搭建私有仓库。

```bash
# 登录 Docker Hub
docker login

# 为镜像打标签
docker tag my-app:latest username/my-app:v1.0

# 推送镜像到仓库
docker push username/my-app:v1.0

# 搜索公共镜像
docker search redis
```

### 二、安装 Docker

#### Linux（以 Ubuntu 为例）

```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 验证安装
sudo docker run hello-world
```

#### 配置免 sudo（可选）

```bash
# 将当前用户加入 docker 组
sudo usermod -aG docker $USER

# 重新登录后生效，验证
docker ps
```

#### 配置镜像加速器

国内用户建议配置镜像加速以提升拉取速度：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 三、Dockerfile 编写

Dockerfile 是一个文本文件，包含了一系列指令，用于自动构建 Docker 镜像。

#### 基本示例：Node.js 应用

```dockerfile
# 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 并安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
```

#### 常用指令说明

| 指令 | 说明 | 示例 |
|------|------|------|
| `FROM` | 指定基础镜像 | `FROM python:3.12-slim` |
| `WORKDIR` | 设置工作目录 | `WORKDIR /app` |
| `COPY` | 复制文件到镜像 | `COPY . /app` |
| `RUN` | 构建时执行命令 | `RUN apt-get update && apt-get install -y curl` |
| `ENV` | 设置环境变量 | `ENV NODE_ENV=production` |
| `EXPOSE` | 声明端口 | `EXPOSE 8080` |
| `CMD` | 容器启动命令 | `CMD ["python", "app.py"]` |
| `ENTRYPOINT` | 固定入口命令 | `ENTRYPOINT ["docker-entrypoint.sh"]` |

#### 构建与优化

```bash
# 构建镜像
docker build -t my-app:1.0 .

# 构建时指定平台
docker build --platform linux/amd64 -t my-app:1.0 .

# 查看镜像分层
docker history my-app:1.0
```

**优化建议**：
- 使用 `.dockerignore` 排除不需要的文件（如 `node_modules`、`.git`）
- 合并 `RUN` 指令以减少镜像层数
- 使用多阶段构建减小最终镜像体积

```dockerfile
# 多阶段构建示例
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o myapp

FROM alpine:3.19
COPY --from=builder /app/myapp /usr/local/bin/
CMD ["myapp"]
```

### 四、容器数据管理

#### 数据卷（Volume）

数据卷由 Docker 管理，独立于容器生命周期，是持久化数据的首选方式。

```bash
# 创建数据卷
docker volume create my-data

# 使用数据卷启动容器
docker run -d --name db -v my-data:/var/lib/postgresql/data postgres:16

# 查看数据卷
docker volume ls
docker volume inspect my-data

# 删除数据卷
docker volume rm my-data
```

#### 绑定挂载（Bind Mount）

将宿主机目录直接映射到容器中，适合开发环境。

```bash
# 将宿主机 ./src 目录映射到容器 /app/src
docker run -d --name dev -v $(pwd)/src:/app/src my-app:1.0
```

### 五、网络配置

Docker 提供多种网络模式：

```bash
# 查看网络列表
docker network ls

# 创建自定义网络
docker network create my-network

# 容器加入指定网络
docker run -d --name app --network my-network my-app:1.0

# 容器间通过名称通信（同一网络内）
docker run -d --name db --network my-network postgres:16
# app 容器中可直接用 "db" 作为主机名连接数据库
```

| 网络模式 | 说明 | 使用场景 |
|---------|------|---------|
| bridge | 默认桥接网络 | 单机容器通信 |
| host | 共享宿主机网络 | 对网络性能要求高 |
| none | 无网络 | 安全隔离场景 |
| 自定义 bridge | 用户创建的桥接网络 | 容器间 DNS 解析通信 |

### 六、实用技巧

#### 查看容器日志

```bash
# 实时查看日志
docker logs -f my-nginx

# 查看最后 100 行
docker logs --tail 100 my-nginx

# 查看指定时间后的日志
docker logs --since "2026-08-15" my-nginx
```

#### 进入容器调试

```bash
# 以交互方式进入容器
docker exec -it my-nginx /bin/bash

# 执行单条命令
docker exec my-nginx cat /etc/nginx/nginx.conf
```

#### 容器资源限制

```bash
# 限制 CPU 和内存
docker run -d --name app \
  --cpus="1.5" \
  --memory="512m" \
  --memory-swap="1g" \
  my-app:1.0
```

#### 清理资源

```bash
# 删除所有已停止的容器
docker container prune

# 删除所有未使用的镜像
docker image prune -a

# 删除所有未使用的资源（容器、镜像、网络、数据卷）
docker system prune -a --volumes
```

## 小结

Docker 通过容器化技术解决了"在我机器上能跑"的经典问题，使应用的构建、分发和运行变得一致且高效。本教程从核心概念出发，覆盖了安装配置、Dockerfile 编写、数据管理和网络配置等关键知识点。

掌握 Docker 的关键在于实践——建议从构建一个自己的应用镜像开始，逐步熟悉镜像分层、多阶段构建、网络通信等进阶特性。在后续教程中，我们将进一步学习 Docker Compose 多容器编排和 Kubernetes 集群管理，构建完整的容器化 DevOps 工作流。
