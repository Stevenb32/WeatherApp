using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Internal;

namespace WeatherApp.Api.Tests;

public sealed class WeatherAppFactory : WebApplicationFactory<Program>
{
    private readonly string _wireMockBaseUrl;

    private readonly TimeSpan _weatherApiTimeout;

    private readonly TimeSpan _weatherApiCacheDuration;

    private readonly ISystemClock? _cacheClock;

    public WeatherAppFactory(
        string wireMockBaseUrl,
        TimeSpan? weatherApiTimeout = null,
        TimeSpan? weatherApiCacheDuration = null,
        ISystemClock? cacheClock = null)
    {
        _wireMockBaseUrl = wireMockBaseUrl;

        _weatherApiTimeout =
            weatherApiTimeout ?? TimeSpan.FromSeconds(10);

        _weatherApiCacheDuration =
            weatherApiCacheDuration ?? TimeSpan.FromMinutes(5);

        _cacheClock = cacheClock;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            var configurationValues = new Dictionary<string, string?>
            {
                ["WeatherApi:BaseUrl"] =
                    $"{_wireMockBaseUrl.TrimEnd('/')}/v1/",

                ["WeatherApi:ApiKey"] = "test-api-key",

                ["WeatherApi:Timeout"] =
                    _weatherApiTimeout.ToString("c"),

                ["WeatherApi:CacheDuration"] =
                    _weatherApiCacheDuration.ToString("c")
            };

            configurationBuilder.AddInMemoryCollection(
                configurationValues);
        });

        var cacheClock = _cacheClock;

        if (cacheClock is not null)
        {
            builder.ConfigureTestServices(services =>
            {
                services.Configure<MemoryCacheOptions>(options =>
                {
                    options.Clock = cacheClock;
                });
            });
        }
    }
}