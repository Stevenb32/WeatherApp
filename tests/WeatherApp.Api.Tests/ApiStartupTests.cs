using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace WeatherApp.Api.Tests;

public sealed class ApiStartupTests
{
    [Theory]
    [InlineData("Production")]
    [InlineData("ContainerSmoke")]
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
        using var factory = new WeatherAppFactory(
            "http://127.0.0.1:9090",
            weatherApiKey: apiKey);
        using var productionFactory = factory.WithWebHostBuilder(
            builder => builder.UseEnvironment("Production"));

        Action start = () => productionFactory.CreateClient();

        start.Should()
            .Throw<OptionsValidationException>()
            .WithMessage("*WeatherApi:ApiKey is required.*");
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
