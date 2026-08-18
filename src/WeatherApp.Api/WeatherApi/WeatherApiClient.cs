using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace WeatherApp.Api.WeatherApi;

public sealed class WeatherApiClient
{
    private readonly HttpClient _httpClient;
    private readonly WeatherApiOptions _options;

    public WeatherApiClient(HttpClient httpClient, IOptions<WeatherApiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<WeatherApiForecastResponse> GetForecastAsync(
        string location, 
        CancellationToken cancellationToken = default)
    {
        var requestUri =
            $"forecast.json?key={Uri.EscapeDataString(_options.ApiKey)}" +
            $"&q={Uri.EscapeDataString(location)}" +
            "&days=3";

        using var response = await _httpClient.GetAsync(requestUri, cancellationToken);

        response.EnsureSuccessStatusCode();

        var forecast =
            await response.Content
                .ReadFromJsonAsync<WeatherApiForecastResponse>(cancellationToken);

        return forecast
            ?? throw new JsonException("WeatherAPI returned an empty response.");
    }
}