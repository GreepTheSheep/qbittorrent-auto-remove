FROM node:lts-alpine

WORKDIR /qbittorrent-auto-remove

COPY package.json /qbittorrent-auto-remove/
COPY package-lock.json /qbittorrent-auto-remove/
COPY src/* /qbittorrent-auto-remove/src/

RUN npm i

CMD [ "node", "src/index.js" ]