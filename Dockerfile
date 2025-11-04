FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 1303
CMD ["npm", "start"]

# CMD ["npm", "run", "server"]
