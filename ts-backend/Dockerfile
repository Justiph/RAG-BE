# ts-backend/Dockerfile
FROM node:20-slim

WORKDIR /app

# copy file manifest trước để cache layer npm
COPY package.json tsconfig.json ./

# cài đầy đủ deps (kể cả dev) để build
RUN npm i

# copy source
COPY src ./src

# build sang JS
RUN npm run build

# chạy production từ thư mục dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
