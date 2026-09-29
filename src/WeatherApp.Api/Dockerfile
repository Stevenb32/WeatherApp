FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

ARG TARGETARCH

# The moving SDK image tag cannot guarantee the version pinned by global.json.
RUN set -eu; \
    case "$TARGETARCH" in \
        amd64) sdk_arch=x64 ;; \
        arm64) sdk_arch=arm64 ;; \
        *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    archive="dotnet-sdk-10.0.303-linux-${sdk_arch}.tar.gz"; \
    url="https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.303/${archive}"; \
    curl --fail --show-error --location --output "$archive" "$url"; \
    curl --fail --show-error --location --output "${archive}.sha512" "${url}.sha512"; \
    sha512sum --check "${archive}.sha512"; \
    mkdir -p /opt/dotnet-10.0.303; \
    tar --gzip --extract --file "$archive" --directory /opt/dotnet-10.0.303; \
    rm "$archive" "${archive}.sha512"

ENV DOTNET_ROOT=/opt/dotnet-10.0.303
ENV PATH="${DOTNET_ROOT}:${PATH}"

WORKDIR /src
COPY global.json ./
RUN test "$(dotnet --version)" = "10.0.303"

COPY src/WeatherApp.Api/WeatherApp.Api.csproj src/WeatherApp.Api/
RUN dotnet restore src/WeatherApp.Api/WeatherApp.Api.csproj

COPY src/WeatherApp.Api/ src/WeatherApp.Api/
RUN dotnet publish src/WeatherApp.Api/WeatherApp.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

ARG SOURCE_REVISION
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

WORKDIR /app
COPY --from=build /app/publish/ .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["dotnet", "WeatherApp.Api.dll"]
