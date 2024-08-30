FROM node:20-alpine

WORKDIR /app

RUN echo -e "update-notifier=false\nloglevel=error" > ~/.npmrc
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --prod
CMD ["npm", "start"]
