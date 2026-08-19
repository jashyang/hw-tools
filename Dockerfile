# ── 多阶段构建：node 构建 → nginx 运行 ──
# PIN 通过 --build-arg VITE_PIN=xxx 注入（不进镜像层历史明文检查：仅构建阶段环境变量）

# [1/2] 构建阶段
FROM node:20-alpine AS build
WORKDIR /app

# 国内 npm 源加速
RUN npm config set registry https://registry.npmmirror.com

# ARG/ENV 传递 PIN（vite.config.js 读取 process.env.VITE_PIN）
ARG VITE_PIN=
ENV VITE_PIN=${VITE_PIN}

COPY package.json ./
RUN npm install --registry=https://registry.npmmirror.com

COPY . .
RUN npm run build

# [2/2] 运行阶段
FROM nginx:alpine

# 时区：东八区
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
