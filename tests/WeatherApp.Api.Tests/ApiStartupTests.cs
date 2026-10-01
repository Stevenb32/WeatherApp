using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace WeatherApp.Api.Tests;

public sealed class ApiStartupTests
{
    [Theory]
    [InlineData("Production")]
    [InlineData("E2E")]
    public async Task HttpEndpointsOutsideDevelopmentDoNotRedirect(string environmentName)
    {
        using var factory = new WeatherAppFactory("http://127.0.0.1:9090");
        using var environmentFactory = factory.WithWebHostBuilder(
            builder => builder.UseEnvironment(environmentName));
        using var client = CreateHttpClient(environmentFactory);

        using var healthResponse = await client.GetAsync("/health");
        using var weatherResponse = await client.GetAsync("/api/weather");

        healthResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        weatherResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DevelopmentHttpRequestRedirectsToHttps()
    {
        using var factory = new WeatherAppFactory("http://127.0.0.1:9090");
        using var developmentFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services =>
                services.Configure<HttpsRedirectionOptions>(options =>
                    options.HttpsPort = 443));
        });
        using var client = CreateHttpClient(developmentFactory);

        using var response = await client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.TemporaryRedirect);
        response.Headers.Location.Should().Be(new Uri("https://localhost/health"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void MissingOrBlankApiKeyFailsAtStartup(string? apiKey)
    {
        using var startupLog = new StartupValidationLogger();
        using var factory = new WeatherAppFactory(
            "http://127.0.0.1:9090",
            weatherApiKey: apiKey);
        using var productionFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.ConfigureLogging(logging => logging.AddProvider(startupLog));
        });

        Action start = () => productionFactory.CreateClient();

        // Failed-host teardown can mask the validation error returned by CreateClient.
        // The host log records the actual startup failure before teardown begins.
        start.Should().Throw<Exception>();
        startupLog.ValidationException.Should()
            .NotBeNull()
            .And.Match<OptionsValidationException>(exception =>
                exception.Message.Contains("WeatherApi:ApiKey is required."));
    }

    [Fact]
    public async Task ContainerSmokeStartsWhenMockIsHealthy()
    {
        var healthHandler = new MockHealthHandler(HttpStatusCode.OK);
        using var factory = new WeatherAppFactory(
            "http://provider-mock:9090",
            weatherApiKey: "weatherapp-e2e-placeholder");
        using var containerSmokeFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("ContainerSmoke");
            builder.ConfigureTestServices(services =>
                services.AddHttpClient("ContainerSmokeMockHealth")
                    .ConfigurePrimaryHttpMessageHandler(() => healthHandler));
        });
        using var client = CreateHttpClient(containerSmokeFactory);

        using var response = await client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        healthHandler.RequestedUri.Should().Be(
            new Uri("http://provider-mock:9090/__admin/health"));
    }

    [Theory]
    [InlineData("https://api.weatherapi.com")]
    [InlineData("http://127.0.0.1:9090")]
    public void ContainerSmokeRejectsOtherProviderUrls(string providerUrl)
    {
        using var factory = new WeatherAppFactory(
            providerUrl,
            weatherApiKey: "weatherapp-e2e-placeholder");
        using var containerSmokeFactory = factory.WithWebHostBuilder(
            builder => builder.UseEnvironment("ContainerSmoke"));

        Action start = () => containerSmokeFactory.CreateClient();

        start.Should()
            .Throw<OptionsValidationException>()
            .WithMessage("*WeatherApi:BaseUrl must be http://provider-mock:9090/v1/*");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("incorrect-key")]
    public void ContainerSmokeRejectsMissingOrWrongApiKey(string? apiKey)
    {
        using var factory = new WeatherAppFactory(
            "http://provider-mock:9090",
            weatherApiKey: apiKey);
        using var containerSmokeFactory = factory.WithWebHostBuilder(
            builder => builder.UseEnvironment("ContainerSmoke"));

        Action start = () => containerSmokeFactory.CreateClient();

        start.Should()
            .Throw<OptionsValidationException>()
            .WithMessage("*WeatherApi:ApiKey*");
    }

    [Fact]
    public void ContainerSmokeRejectsUnavailableMock()
    {
        var healthHandler = new MockHealthHandler(statusCode: null);
        using var factory = new WeatherAppFactory(
            "http://provider-mock:9090",
            weatherApiKey: "weatherapp-e2e-placeholder");
        using var containerSmokeFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("ContainerSmoke");
            builder.ConfigureTestServices(services =>
                services.AddHttpClient("ContainerSmokeMockHealth")
                    .ConfigurePrimaryHttpMessageHandler(() => healthHandler));
        });

        Action start = () => containerSmokeFactory.CreateClient();

        start.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("*requires a healthy provider-mock*");
        healthHandler.RequestedUri.Should().Be(
            new Uri("http://provider-mock:9090/__admin/health"));
    }

    private sealed class MockHealthHandler(HttpStatusCode? statusCode)
        : HttpMessageHandler
    {
        public Uri? RequestedUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestedUri = request.RequestUri;

            if (statusCode is null)
            {
                throw new HttpRequestException("The mock is unavailable.");
            }

            return Task.FromResult(new HttpResponseMessage(statusCode.Value));
        }
    }

    private sealed class StartupValidationLogger : ILoggerProvider, ILogger
    {
        public OptionsValidationException? ValidationException { get; private set; }

        public ILogger CreateLogger(string categoryName) => this;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
            => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel >= LogLevel.Error &&
                exception is OptionsValidationException validationException)
            {
                ValidationException = validationException;
            }
        }

        public void Dispose() { }
    }

    private static HttpClient CreateHttpClient(WebApplicationFactory<Program> factory)
    {
        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://localhost"),
            AllowAutoRedirect = false
        });
    }
}
