using System.Net;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;

namespace WeatherApp.Api.Tests;

public sealed class WeatherEndpointTests
{
    [Fact]
    public async Task GetHealth_WhenWeatherProviderIsUnavailable_ReturnsOk()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet())
            .RespondWith(
                Response.Create()
                    .WithStatusCode(500));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().BeEmpty();
    }

    [Theory]
    [InlineData("imperial")]
    [InlineData("IMPERIAL")]
    public async Task GetWeather_WhenImperialUnitsAreRequested_ReturnsPublicWeatherResponse(string units)
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            $"/api/weather?location=Tampa&units={units}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("location")
            .GetProperty("name")
            .GetString()
            .Should()
            .Be("Tampa");

        root
            .GetProperty("unitSystem")
            .GetString()
            .Should()
            .Be("imperial");

        root
            .GetProperty("current")
            .GetProperty("temperature")
            .GetDouble()
            .Should()
            .Be(87.8);

        root
            .GetProperty("current")
            .GetProperty("windSpeed")
            .GetDouble()
            .Should()
            .Be(8.1);

        root
            .GetProperty("hourly")
            .GetArrayLength()
            .Should()
            .Be(24);

        root
            .GetProperty("daily")
            .GetArrayLength()
            .Should()
            .Be(3);

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenSameLocationIsRequestedTwice_CallsWeatherProviderOnlyOnce()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var firstResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();

        var secondResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenSameLocationIsRequestedWithDifferentUnits_ReusesCachedProviderResponse()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var imperialResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        imperialResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var imperialDocument = JsonDocument.Parse(
            await imperialResponse.Content.ReadAsStringAsync());

        var imperialRoot = imperialDocument.RootElement;

        imperialRoot
            .GetProperty("unitSystem")
            .GetString()
            .Should()
            .Be("imperial");

        imperialRoot
            .GetProperty("current")
            .GetProperty("temperature")
            .GetDouble()
            .Should()
            .Be(87.8);

        imperialRoot
            .GetProperty("current")
            .GetProperty("windSpeed")
            .GetDouble()
            .Should()
            .Be(8.1);

        server.LogEntries.Should().ContainSingle();

        var metricResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=metric");

        metricResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var metricDocument = JsonDocument.Parse(
            await metricResponse.Content.ReadAsStringAsync());

        var metricRoot = metricDocument.RootElement;

        metricRoot
            .GetProperty("unitSystem")
            .GetString()
            .Should()
            .Be("metric");

        metricRoot
            .GetProperty("current")
            .GetProperty("temperature")
            .GetDouble()
            .Should()
            .Be(31.0);

        metricRoot
            .GetProperty("current")
            .GetProperty("windSpeed")
            .GetDouble()
            .Should()
            .Be(13.0);

        server.LogEntries.Should().ContainSingle();
    }

    [Theory]
    [InlineData("tampa")]
    [InlineData("TAMPA")]
    [InlineData(" Tampa ")]
    [InlineData(" tAmPa ")]
    public async Task GetWeather_WhenLocationCasingOrWhitespaceDiffers_ReusesCachedProviderResponse(
        string locationVariant)
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var firstResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();

        var encodedLocation = Uri.EscapeDataString(locationVariant);

        var secondResponse = await client.GetAsync(
            $"/api/weather?location={encodedLocation}&units=imperial");

        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenDifferentLocationsAreRequested_UsesSeparateCacheEntries()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server, "Tampa");

        ConfigureSuccessfulWeatherResponse(server, "Orlando");

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var tampaResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        tampaResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var tampaDocument = JsonDocument.Parse(
            await tampaResponse.Content.ReadAsStringAsync());

        tampaDocument.RootElement
            .GetProperty("location")
            .GetProperty("name")
            .GetString()
            .Should()
            .Be("Tampa");

        server.LogEntries.Should().ContainSingle();

        var orlandoResponse = await client.GetAsync(
            "/api/weather?location=Orlando&units=imperial");

        orlandoResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var orlandoDocument = JsonDocument.Parse(
            await orlandoResponse.Content.ReadAsStringAsync());

        orlandoDocument.RootElement
            .GetProperty("location")
            .GetProperty("name")
            .GetString()
            .Should()
            .Be("Orlando");

        server.LogEntries.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetWeather_WhenCacheEntryExpires_CallsWeatherProviderAgain()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        var cacheDuration = TimeSpan.FromMinutes(5);

        var clock = new TestSystemClock(
            new DateTimeOffset(
                2026,
                8,
                25,
                12,
                0,
                0,
                TimeSpan.Zero));

        using var factory = new WeatherAppFactory(
            server.Urls[0],
            weatherApiCacheDuration: cacheDuration,
            cacheClock: clock);

        using var client = CreateApiClient(factory);

        var firstResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();

        clock.Advance(
            cacheDuration - TimeSpan.FromSeconds(1));

        var beforeExpirationResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        beforeExpirationResponse.StatusCode
            .Should()
            .Be(HttpStatusCode.OK);

        server.LogEntries.Should().ContainSingle();

        clock.Advance(TimeSpan.FromSeconds(2));

        var afterExpirationResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        afterExpirationResponse.StatusCode
            .Should()
            .Be(HttpStatusCode.OK);

        server.LogEntries.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetWeather_WhenProviderRequestFails_DoesNotCacheFailure()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(500));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var firstResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        firstResponse.StatusCode
            .Should()
            .Be(HttpStatusCode.ServiceUnavailable);

        server.LogEntries.Should().ContainSingle();

        var secondResponse = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        secondResponse.StatusCode
            .Should()
            .Be(HttpStatusCode.ServiceUnavailable);

        server.LogEntries.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetWeather_WhenRateLimitIsExceeded_ReturnsTooManyRequests()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(
            server.Urls[0],
            weatherRateLimitPermitLimit: 1,
            weatherRateLimitWindow: TimeSpan.FromHours(1));

        using var client = CreateApiClient(factory);

        const string requestUrl =
            "/api/weather?location=Tampa&units=imperial";

        using var firstResponse = await client.GetAsync(requestUrl);

        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var secondResponse = await client.GetAsync(requestUrl);

        secondResponse.StatusCode.Should()
            .Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task GetHealth_WhenWeatherRateLimitIsExhausted_ReturnsOk()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(
            server.Urls[0],
            weatherRateLimitPermitLimit: 1,
            weatherRateLimitWindow: TimeSpan.FromHours(1));

        using var client = CreateApiClient(factory);

        const string weatherRequestUrl =
            "/api/weather?location=Tampa&units=imperial";

        using var firstWeatherResponse =
            await client.GetAsync(weatherRequestUrl);

        firstWeatherResponse.StatusCode.Should()
            .Be(HttpStatusCode.OK);

        using var secondWeatherResponse =
            await client.GetAsync(weatherRequestUrl);

        secondWeatherResponse.StatusCode.Should()
            .Be(HttpStatusCode.TooManyRequests);

        using var healthResponse = await client.GetAsync("/health");

        healthResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetWeather_WhenProviderReturnsTooManyRequests_ReturnsServiceUnavailable()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(429)
                    .WithHeader("Content-Type", "application/json")
                    .WithBody(
                        """
                    {
                      "error": {
                        "code": 2007,
                        "message": "API request quota exceeded."
                      }
                    }
                    """));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        using var response = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        response.StatusCode.Should()
            .Be(HttpStatusCode.ServiceUnavailable);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        document.RootElement
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Weather provider unavailable");

        server.LogEntries.Should().ContainSingle();
    }

    [Theory]
    [InlineData("metric")]
    [InlineData("METRIC")]
    public async Task GetWeather_WhenMetricUnitsAreRequested_ReturnsMetricWeatherResponse(string units)
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            $"/api/weather?location=Tampa&units={units}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("unitSystem")
            .GetString()
            .Should()
            .Be("metric");

        root
            .GetProperty("current")
            .GetProperty("temperature")
            .GetDouble()
            .Should()
            .Be(31.0);

        root
            .GetProperty("current")
            .GetProperty("windSpeed")
            .GetDouble()
            .Should()
            .Be(13.0);

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenUnitsAreOmitted_DefaultsToImperial()
    {
        using var server = WireMockServer.Start();

        ConfigureSuccessfulWeatherResponse(server);

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=Tampa");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("unitSystem")
            .GetString()
            .Should()
            .Be("imperial");

        root
            .GetProperty("current")
            .GetProperty("temperature")
            .GetDouble()
            .Should()
            .Be(87.8);

        server.LogEntries.Should().ContainSingle();
    }

    [Theory]
    [InlineData("/api/weather")]
    [InlineData("/api/weather?location=")]
    [InlineData("/api/weather?location=%20%20")]
    public async Task GetWeather_WhenLocationIsMissingOrBlank_ReturnsBadRequest(string requestUrl)
    {
        using var server = WireMockServer.Start();

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(requestUrl);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Invalid location");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(400);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be("A location must be provided.");

        server.LogEntries.Should().BeEmpty();
    }

    [Theory]
    [InlineData("kelvin")]
    [InlineData("0")]
    [InlineData("1")]
    public async Task GetWeather_WhenUnitsAreInvalid_ReturnsBadRequest(string units)
    {
        using var server = WireMockServer.Start();

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            $"/api/weather?location=Tampa&units={units}");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Invalid units");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(400);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be("Units must be either imperial or metric.");

        server.LogEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWeather_WhenLocationIsUnknown_ReturnsNotFound()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "NotARealPlace")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(400)
                    .WithHeader("Content-Type", "application/json")
                    .WithBody(
                        """
                    {
                      "error": {
                        "code": 1006,
                        "message": "No location found matching parameter 'q'"
                      }
                    }
                    """));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=NotARealPlace&units=imperial");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        var responseBody = await response.Content.ReadAsStringAsync();

        responseBody.Should().NotContain("1006");

        responseBody.Should().NotContain("No location found matching parameter");

        using var document = JsonDocument.Parse(responseBody);

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Location not found");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(404);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be("The requested location could not be found.");

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenProviderReturnsServerError_ReturnsServiceUnavailable()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(500));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        response.StatusCode.Should()
            .Be(HttpStatusCode.ServiceUnavailable);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        var responseBody = await response.Content.ReadAsStringAsync();

        responseBody.Should().NotContain(
            "WeatherAPI request failed");

        using var document = JsonDocument.Parse(responseBody);

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Weather provider unavailable");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(503);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be(
                "Weather data is temporarily unavailable. " +
                "Please try again later.");

        server.LogEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task GetWeather_WhenProviderTimesOut_ReturnsGatewayTimeout()
    {
        using var server = WireMockServer.Start();

        var providerResponse = WeatherApiForecastFixture.Create();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(200)
                    .WithHeader("Content-Type", "application/json")
                    .WithDelay(TimeSpan.FromSeconds(2))
                    .WithBody(
                        JsonSerializer.Serialize(providerResponse)));

        using var factory = new WeatherAppFactory(
            server.Urls[0],
            weatherApiTimeout: TimeSpan.FromMilliseconds(500));

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        response.StatusCode.Should()
            .Be(HttpStatusCode.GatewayTimeout);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Weather provider timeout");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(504);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be("The weather provider did not respond in time.");
    }

    [Fact]
    public async Task GetWeather_WhenProviderCannotBeReached_ReturnsServiceUnavailable()
    {
        using var server = WireMockServer.Start();

        var serverUrl = server.Urls[0];

        server.Stop();

        using var factory = new WeatherAppFactory(serverUrl);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        response.StatusCode.Should()
            .Be(HttpStatusCode.ServiceUnavailable);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Weather provider unavailable");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(503);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be(
                "Weather data is temporarily unavailable. " +
                "Please try again later.");
    }

    [Theory]
    [InlineData(HttpStatusCode.RequestTimeout)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    public async Task GetWeather_WhenProviderReturnsTimeoutStatus_ReturnsGatewayTimeout(HttpStatusCode providerStatusCode)
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode((int)providerStatusCode));

        using var factory = new WeatherAppFactory(server.Urls[0]);

        using var client = CreateApiClient(factory);

        var response = await client.GetAsync(
            "/api/weather?location=Tampa&units=imperial");

        response.StatusCode.Should()
            .Be(HttpStatusCode.GatewayTimeout);

        response.Content.Headers.ContentType
            .Should()
            .NotBeNull();

        response.Content.Headers.ContentType!.MediaType
            .Should()
            .Be("application/problem+json");

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root
            .GetProperty("title")
            .GetString()
            .Should()
            .Be("Weather provider timeout");

        root
            .GetProperty("status")
            .GetInt32()
            .Should()
            .Be(504);

        root
            .GetProperty("detail")
            .GetString()
            .Should()
            .Be("The weather provider did not respond in time.");

        server.LogEntries.Should().ContainSingle();
    }

    // private helpers
    private static HttpClient CreateApiClient(WeatherAppFactory factory)
    {
        return factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false
            });
    }

    private static void ConfigureSuccessfulWeatherResponse(WireMockServer server, string location = "Tampa")
    {
        var providerResponse = WeatherApiForecastFixture.Create();

        providerResponse.Location.Name = location;

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", location)
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(200)
                    .WithHeader("Content-Type", "application/json")
                    .WithBody(
                        JsonSerializer.Serialize(providerResponse)));
    }
}