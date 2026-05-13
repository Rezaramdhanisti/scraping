FROM debian:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=host.docker.internal:0

RUN apt update && apt upgrade -y

RUN apt install -y \
    chromium \
    wget \
    vim

RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

WORKDIR /app
COPY . .

RUN bash -c "source /root/.bashrc && nvm install --lts && npm i -g pm2 && npm i"

RUN mkdir -p /root/tmp
ENV TMPDIR=/root/tmp

EXPOSE 3001
