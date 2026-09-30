FROM mcr.microsoft.com/dotnet/sdk:10.0

WORKDIR /app
COPY .config/dotnet-tools.json .config/dotnet-tools.json
RUN dotnet tool restore --tool-manifest .config/dotnet-tools.json

# The existing tests/TestEnvironment/WireMock directory is mounted here read-only.
WORKDIR /app/wiremock
EXPOSE 9090

ENTRYPOINT ["dotnet", "tool", "run", "dotnet-wiremock", "--", "--Urls", "http://0.0.0.0:9090", "--ReadStaticMappings", "true", "--StartAdminInterface", "true", "--WireMockLogger", "WireMockConsoleLogger"]
