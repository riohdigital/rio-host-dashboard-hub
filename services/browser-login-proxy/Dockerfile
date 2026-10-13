# Rioh Host — proxy de login das plataformas.
#
# Sem estado próprio: o perfil do navegador mora no volume do Browserless
# (/data/profiles), não aqui. Reiniciar este container só derruba um login em
# andamento.

FROM node:20-alpine

# tini: sem init, o Node vira PID 1 e ignora SIGTERM — o login em andamento
# seria morto sem fechar o navegador (e o perfil não seria gravado).
RUN apk add --no-cache tini

WORKDIR /app

COPY package.json ./
# puppeteer-core não baixa navegador: ele só conversa com o Browserless.
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY src/ ./src/

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
