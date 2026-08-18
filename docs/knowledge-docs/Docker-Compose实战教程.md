---
permalink: /docs/knowledge-docs/Docker-Compose实战教程/
title: Docker Compose实战教程
description: 学习使用 Docker Compose 进行多容器编排，掌握服务定义、依赖管理、环境配置与生产部署实践
category: 云计算
tags:
  - Docker
  - Docker-Compose
  - 容器编排
author: Stam
date: 2026-08-15 16:53:33
toc: "true"
layout: doc
---
## 概述

Docker Compose 是一个用于定义和运行多容器 Docker 应用的工具。通过一个 YAML 文件，你可以描述应用的所有服务、网络和数据卷，然后用一条命令启动整个应用栈。

如果说 Docker 解决了单个容器的构建与运行问题，那么 Docker Compose 解决的就是多个容器之间的编排与协作问题。无论是本地开发环境还是中小规模的生产部署，Docker Compose 都是不可或缺的利器。

## 核心内容

### 一、安装 Docker Compose

Docker Compose V2 已作为 Docker CLI 插件集成，安装 Docker Engine 时会自动安装：

```bash
# 验证安装
docker compose version

# 如果版本较旧，可单独安装插件
sudo apt-get install docker-compose-plugin
```

> Docker Compose V2 使用 `docker compose`（空格）命令，V1 使用 `docker-compose`（连字符）。推荐使用 V2。

### 二、编写 docker-compose.yml

#### 基础示例：Web 应用 + 数据库

```yaml
version: "3.9"

services:
  # Web 前端服务
  web:
    build: ./frontend
    ports:
      - "8080:3000"
    depends_on:
      - api
    environment:
      - API_URL=http://api:4000
    restart: unless-stopped

  # 后端 API 服务
  api:
    build: ./backend
    ports:
      - "4000:4000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://app:secret@db:5432/myapp
    restart: unless-stopped

  # PostgreSQL 数据库
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db-data:
```

#### 核心字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `build` | 从 Dockerfile 构建镜像 | `build: ./frontend` |
| `image` | 使用已有镜像 | `image: nginx:alpine` |
| `ports` | 端口映射 | `ports: ["8080:80"]` |
| `volumes` | 数据卷挂载 | `volumes: ["./data:/app/data"]` |
| `environment` | 环境变量 | `environment: ["DEBUG=true"]` |
| `depends_on` | 服务依赖 | `depends_on: [db]` |
| `restart` | 重启策略 | `restart: always` |
| `healthcheck` | 健康检查 | 见上方示例 |
| `networks` | 加入指定网络 | `networks: [frontend]` |
| `command` | 覆盖启动命令 | `command: ["gunicorn", "-w", "4"]` |

### 三、常用命令

```bash
# 启动所有服务（后台运行）
docker compose up -d

# 启动并强制重新构建镜像
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志（实时跟踪）
docker compose logs -f

# 查看指定服务日志
docker compose logs -f api

# 进入容器执行命令
docker compose exec api sh

# 停止所有服务
docker compose stop

# 停止并删除容器、网络
docker compose down

# 停止并删除容器、网络、数据卷（慎用）
docker compose down -v

# 重新启动单个服务
docker compose restart api

# 查看服务资源使用
docker compose stats
```

### 四、多环境配置

实际项目中通常需要区分开发、测试和生产环境。Docker Compose 支持通过多个文件叠加配置：

#### 基础配置 `docker-compose.yml`

```yaml
version: "3.9"

services:
  api:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://app:secret@db:5432/myapp
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

#### 开发环境覆盖 `docker-compose.dev.yml`

```yaml
version: "3.9"

services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    volumes:
      # 挂载源码实现热重载
      - ./backend/src:/app/src
    environment:
      - DEBUG=true
      - NODE_ENV=development

  db:
    ports:
      - "5432:5432"
```

#### 生产环境覆盖 `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - DEBUG=false
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  db:
    restart: always
```

#### 使用方式

```bash
# 开发环境启动
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 生产环境启动
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

也可以通过 `.env` 文件管理环境变量：

```bash
# .env 文件
POSTGRES_USER=app
POSTGRES_PASSWORD=secret
POSTGRES_DB=myapp
```

```yaml
# docker-compose.yml 中引用
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
```

### 五、网络与服务发现

Docker Compose 自动为应用创建一个默认网络，同一 Compose 项目中的服务可以通过服务名互相访问：

```yaml
version: "3.9"

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    depends_on:
      - redis
      - db

  redis:
    image: redis:7-alpine

  db:
    image: postgres:16-alpine
```

在此配置中：
- `frontend` 容器可以通过 `http://backend:4000` 访问后端
- `backend` 容器可以通过 `redis:6379` 连接 Redis、通过 `db:5432` 连接数据库
- 无需手动配置 IP 地址，Docker 内置 DNS 自动解析服务名

### 六、实战案例：WordPress 博客

```yaml
version: "3.9"

services:
  wordpress:
    image: wordpress:6.5-php8.2-apache
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp_secret
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wp-data:/var/www/html
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp_secret
      MYSQL_ROOT_PASSWORD: root_secret
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  wp-data:
  db-data:
```

```bash
# 一键启动 WordPress 博客
docker compose up -d

# 访问 http://localhost:8080 即可进入安装向导
```

### 七、生产部署注意事项

1. **安全**：不要在 Compose 文件中硬编码密码，使用 Docker Secrets 或外部密钥管理工具
2. **日志**：配置日志驱动和大小限制，避免磁盘被日志撑满
3. **资源限制**：为每个服务设置 CPU 和内存上限
4. **健康检查**：为关键服务配置 healthcheck，确保依赖顺序正确
5. **滚动更新**：使用 `docker compose up -d --no-deps --build api` 重建单个服务而不影响其他服务

```yaml
# 日志配置示例
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

## 小结

Docker Compose 让多容器应用的定义和管理变得简洁高效。通过一个 YAML 文件描述完整的应用架构，配合多环境覆盖文件实现开发-测试-生产的配置管理，大幅降低了容器化应用的运维复杂度。

对于更大规模的集群部署场景（跨多台主机、自动扩缩容、滚动发布等），可以进一步学习 Kubernetes。但对于中小规模项目、本地开发环境和 CI/CD 流水线，Docker Compose 已经是足够强大且易用的选择。
