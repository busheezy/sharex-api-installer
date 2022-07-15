FROM node:16

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

RUN mkdir -p /setup-sharex/output
WORKDIR /setup-sharex

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY . .

RUN pnpm install @nestjs/cli@^8.0.0 && pnpm build

VOLUME [ "/setup-sharex/output" ]

CMD [ "pnpm", "start" ]