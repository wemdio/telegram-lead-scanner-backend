# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Очищаем npm cache и устанавливаем зависимости
RUN npm cache clean --force
RUN npm install

# Копируем исходный код
COPY . .

# Открываем порт 3001
EXPOSE 3001

# Запускаем приложение напрямую через node
CMD ["node", "index.js"]