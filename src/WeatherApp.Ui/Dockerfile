FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app
COPY src/WeatherApp.Ui/package.json src/WeatherApp.Ui/package-lock.json ./
RUN npm ci

COPY src/WeatherApp.Ui/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

ARG SOURCE_REVISION
USER root
RUN set -eu; \
    if [ "${#SOURCE_REVISION}" -ne 40 ]; then \
        echo "SOURCE_REVISION must be a full 40-character commit SHA" >&2; \
        exit 1; \
    fi; \
    case "$SOURCE_REVISION" in \
        *[!0-9a-f]*) echo "SOURCE_REVISION must be lowercase hexadecimal" >&2; exit 1 ;; \
    esac
LABEL org.opencontainers.image.source="https://github.com/Stevenb32/WeatherApp" \
      org.opencontainers.image.revision="${SOURCE_REVISION}"

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/ /usr/share/nginx/html/

USER nginx
EXPOSE 8080
