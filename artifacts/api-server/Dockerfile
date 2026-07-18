FROM node:24-slim

# Python 3 runtime for the resume-analysis subprocess spawned by
# artifacts/api-server/src/ai-resume-analyzer.ts (src/simple-career-analyzer.py).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY artifacts/api-server/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

WORKDIR /app/artifacts/api-server
ENV NODE_ENV=production
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
