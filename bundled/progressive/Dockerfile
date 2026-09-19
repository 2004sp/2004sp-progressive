FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends default-jdk git ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/server
COPY . .

RUN cd engine && npm install

EXPOSE 8888/tcp
ENTRYPOINT ["/opt/server/start.sh"]
