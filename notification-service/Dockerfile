# Stage 1: compilar wacli con Go
FROM golang:1.25-alpine AS wacli-builder
RUN go install github.com/steipete/wacli/cmd/wacli@latest

# Stage 2: runtime Node
FROM node:20-alpine
COPY --from=wacli-builder /go/bin/wacli /usr/local/bin/wacli

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

EXPOSE 3000
CMD ["node", "src/index.js"]
