---
permalink: /docs/knowledge-docs/Kubernetes基础教程/
title: Kubernetes基础教程
description: 系统学习 Kubernetes 容器编排平台，涵盖架构原理、核心资源对象与实战部署全流程
category: 云计算
tags:
  - Kubernetes
  - K8s
  - 容器编排
  - 云原生
author: Stam
date: 2026-08-15 16:53:33
toc: "true"
layout: doc
---
## 概述

Kubernetes（简称 K8s）是 Google 基于内部容器管理系统 Borg 的经验开源的容器编排平台。它负责自动部署、扩展和管理容器化应用，已成为云原生领域的基础设施标准。

如果说 Docker 让单个容器的构建和运行变得简单，那么 Kubernetes 解决的就是**如何在成百上千台机器上管理成千上万个容器**的问题——包括调度、扩缩容、故障恢复、滚动更新和服务发现。

## 核心内容

### 一、架构概览

Kubernetes 采用主从架构，集群由控制平面（Control Plane）和工作节点（Worker Node）组成。

```
┌─────────────────────────────────────────────────┐
│                 Control Plane                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ API Server│ │ Scheduler │ │ Controller Mgr│ │
│  └───────────┘ └───────────┘ └───────────────┘ │
│  ┌───────────────────────────────────────────┐  │
│  │              etcd (状态存储)               │  │
│  └───────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────▼──────┐ ┌───▼───────┐ ┌──▼──────────┐
   │ Worker Node 1│ │Worker Node2│ │Worker Node 3│
   │ ┌─────────┐ │ │┌─────────┐│ │┌─────────┐  │
   │ │kubelet  │ │ ││kubelet  ││ ││kubelet  │  │
   │ ├─────────┤ │ │├─────────┤│ │├─────────┤  │
   │ │kube-proxy│ │ ││kube-proxy│ ││kube-proxy│ │
   │ ├─────────┤ │ │├─────────┤│ │├─────────┤  │
   │ │Pods     │ │ ││Pods     ││ ││Pods     │  │
   │ └─────────┘ │ │└─────────┘│ │└─────────┘  │
   └─────────────┘ └───────────┘ └─────────────┘
```

#### 控制平面组件

| 组件 | 职责 |
|------|------|
| **API Server** | 集群入口，所有组件通过它通信 |
| **etcd** | 键值数据库，存储集群所有状态数据 |
| **Scheduler** | 决定 Pod 调度到哪个节点 |
| **Controller Manager** | 运行各种控制器，维护集群期望状态 |
| **Cloud Controller Manager** | 与云厂商交互 |

#### 工作节点组件

| 组件 | 职责 |
|------|------|
| **kubelet** | 管理节点上的 Pod 生命周期 |
| **kube-proxy** | 维护网络规则，实现服务发现和负载均衡 |
| **容器运行时** | 运行容器（containerd / CRI-O 等） |

### 二、核心资源对象

#### 1. Pod — 最小调度单元

Pod 是 K8s 中最小的可部署单元，包含一个或多个紧密耦合的容器。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.25-alpine
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "200m"
          memory: "256Mi"
```

```bash
# 创建 Pod
kubectl apply -f pod.yaml

# 查看 Pod
kubectl get pods
kubectl describe pod nginx-pod

# 查看 Pod 日志
kubectl logs nginx-pod

# 进入 Pod
kubectl exec -it nginx-pod -- /bin/sh
```

#### 2. Deployment — 无状态应用管理

Deployment 管理 Pod 的副本集，支持滚动更新和回滚。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: my-app:2.0
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

```bash
# 部署应用
kubectl apply -f deployment.yaml

# 查看部署状态
kubectl get deployments
kubectl rollout status deployment/web-app

# 滚动更新（更新镜像版本）
kubectl set image deployment/web-app web=my-app:2.1

# 查看更新历史
kubectl rollout history deployment/web-app

# 回滚到上一版本
kubectl rollout undo deployment/web-app

# 回滚到指定版本
kubectl rollout undo deployment/web-app --to-revision=2

# 水平扩缩容
kubectl scale deployment/web-app --replicas=5
```

#### 3. Service — 服务发现与负载均衡

Service 为一组 Pod 提供固定的访问入口和负载均衡。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  type: ClusterIP    # 集群内部访问
  selector:
    app: web
  ports:
    - port: 80         # Service 端口
      targetPort: 3000 # Pod 端口
```

Service 类型说明：

| 类型 | 说明 | 使用场景 |
|------|------|---------|
| ClusterIP | 集群内部 IP（默认） | 集群内服务间通信 |
| NodePort | 在节点上开放端口 | 外部访问（测试用） |
| LoadBalancer | 云厂商负载均衡器 | 生产环境外部访问 |
| ExternalName | DNS CNAME 别名 | 引用外部服务 |

```yaml
# NodePort 示例
apiVersion: v1
kind: Service
metadata:
  name: web-external
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30080   # 节点端口（30000-32767）
```

#### 4. ConfigMap 与 Secret — 配置管理

```yaml
# ConfigMap — 非敏感配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  config.yaml: |
    database:
      host: db-service
      port: 5432
      pool_size: 10
---
# Secret — 敏感信息
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  url: cG9zdGdyZXNxbDovL2FwcDpzZWNyZXRAZGI6NTQzMi9teWFwcA==  # base64 编码
  password: c2VjcmV0  # base64("secret")
```

在 Pod 中引用：

```yaml
spec:
  containers:
    - name: app
      image: my-app:2.0
      envFrom:
        - configMapRef:
            name: app-config        # 注入所有 ConfigMap 变量
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
```

#### 5. Ingress — HTTP 路由

Ingress 提供 HTTP/HTTPS 路由，支持域名和路径转发。

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 4000
```

### 三、存储管理

#### PersistentVolume 与 PersistentVolumeClaim

```yaml
# PersistentVolume — 集群管理员定义的存储
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-data
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  hostPath:
    path: /mnt/data
---
# PersistentVolumeClaim — 用户申请存储
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 5Gi
```

在 Pod 中使用：

```yaml
spec:
  containers:
    - name: app
      image: my-app:2.0
      volumeMounts:
        - name: data
          mountPath: /app/data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: pvc-data
```

### 四、常用 kubectl 命令速查

```bash
# === 集群信息 ===
kubectl cluster-info
kubectl get nodes
kubectl top nodes                    # 查看节点资源使用

# === 资源查看 ===
kubectl get pods -A                  # 查看所有命名空间的 Pod
kubectl get pods -o wide             # 显示详细信息
kubectl get all                      # 查看所有资源
kubectl get pods --watch             # 实时监控

# === 调试 ===
kubectl describe pod <pod-name>      # 查看 Pod 详情
kubectl logs <pod-name> -f           # 跟踪日志
kubectl exec -it <pod-name> -- sh   # 进入容器
kubectl port-forward svc/web 8080:80 # 端口转发到本地

# === 标签与选择 ===
kubectl get pods -l app=web          # 按标签筛选
kubectl label pod <pod-name> env=prod # 添加标签

# === 命名空间 ===
kubectl get namespaces
kubectl create namespace production
kubectl config set-context --current --namespace=production

# === 应用管理 ===
kubectl apply -f deploy.yaml         # 创建/更新资源
kubectl delete -f deploy.yaml        # 删除资源
kubectl delete pod <pod-name>        # 删除 Pod（Deployment 会自动重建）
```

### 五、快速搭建本地集群

#### 使用 Minikube

```bash
# 安装 Minikube（Linux）
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 启动集群
minikube start --driver=docker

# 验证
kubectl get nodes

# 启用 Ingress 插件
minikube addons enable ingress

# 打开 Dashboard
minikube dashboard
```

#### 使用 Kind（Kubernetes in Docker）

```bash
# 安装 Kind
go install sigs.k8s.io/kind@latest

# 创建集群
kind create cluster --name my-cluster

# 加载本地镜像到集群
kind load docker-image my-app:2.0 --name my-cluster
```

## 小结

Kubernetes 是容器编排领域的事实标准，掌握它需要理解其声明式的设计理念——你描述"期望状态"，K8s 负责让实际状态不断趋近期望状态。

本教程覆盖了 K8s 的核心架构和最常用的资源对象（Pod、Deployment、Service、ConfigMap/Secret、Ingress、PV/PVC）。从单机 Minikube 练手，逐步过渡到多节点集群实践，是学习 K8s 的推荐路径。

进阶方向包括：Helm 包管理、Operator 模式、服务网格（Istio）、监控告警（Prometheus + Grafana）、CI/CD 流水线（ArgoCD）等云原生生态技术。容器化是现代软件交付的基础设施，而 Kubernetes 则是这张技术版图的核心枢纽。
