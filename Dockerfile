FROM node:22-slim

# Устанавливаем сертификаты для безопасного подключения к LiveKit Cloud
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Оптимизированная установка зависимостей
COPY package*.json ./
RUN npm ci

# Копируем остальной код
COPY . .

# Если у вас есть этап сборки (например, TypeScript / Next.js)
RUN npm run build

# Инструкция EXPOSE НЕ НУЖНА, так как агент сам инициирует соединение наружу

CMD ["npm", "start"]
