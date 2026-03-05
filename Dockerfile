FROM node:20

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY ./package.json /app_build/

COPY ./server/package.json /node-app/

RUN cd /app_build && npm install

RUN cd /node-app && npm install --production

WORKDIR /app_build

COPY . .

RUN npm run build

WORKDIR /node-app

COPY ./server/libs ./libs
COPY ./server/sql ./sql
COPY ./server/messageTemplate ./messageTemplate
COPY ./server/static ./static
COPY ./server/* ./

RUN cp -r /app_build/build ./build

EXPOSE 8040

# 启动应用
CMD ["npm", "run", "start"]

