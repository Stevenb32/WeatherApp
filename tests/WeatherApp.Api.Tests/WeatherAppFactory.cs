using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace WeatherApp.Api.Tests;

public sealed class WeatherAppFactory : WebApplicationFactory<Program>
{
    private readonly string _wireMockBaseUrl;

    private readonly TimeSpan _weatherApiTimeout;

    public WeatherAppFactory(
        string wireMockBaseUrl,
        TimeSpan? weatherApiTimeout = null)
    {
        _wireMockBaseUrl = wireMockBaseUrl;

        _weatherApiTimeout =
            weatherApiTimeout ?? TimeSpan.FromSeconds(10);
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
                    _weatherApiTimeout.ToString("c")
            };

            configurationBuilder.AddInMemoryCollection(
                configurationValues);
        });
    }
}