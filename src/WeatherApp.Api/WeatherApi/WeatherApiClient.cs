using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace WeatherApp.Api.WeatherApi;

public sealed class WeatherApiClient
{
    private readonly HttpClient _httpClient;
    private readonly WeatherApiOptions _options;

    public WeatherApiClient(
        HttpClient httpClient,
        IOptions<WeatherApiOptions> options)
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

        using var response =
            await _httpClient.GetAsync(requestUri, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var exception =
                await CreateExceptionAsync(response, cancellationToken);

            throw exception;
        }

        var forecast =
            await response.Content
                .ReadFromJsonAsync<WeatherApiForecastResponse>(
                    cancellationToken);

        return forecast
            ?? throw new JsonException(
                "WeatherAPI returned an empty response.");
    }

    private static async Task<WeatherApiException> CreateExceptionAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        WeatherApiErrorResponse? errorResponse = null;
        Exception? innerException = null;

        try
        {
            errorResponse =
                await response.Content
                    .ReadFromJsonAsync<WeatherApiErrorResponse>(
                        cancellationToken);
        }
        catch (JsonException exception)
        {
            innerException = exception;
        }
        catch (NotSupportedException exception)
        {
            innerException = exception;
        }

        int? providerErrorCode =
            errorResponse is not null &&
            errorResponse.Error.Code > 0
                ? errorResponse.Error.Code
                : null;

        var providerMessage = errorResponse?.Error.Message;

        var message =
            string.IsNullOrWhiteSpace(providerMessage)
                ? $"WeatherAPI request failed with status code {(int)response.StatusCode}."
                : providerMessage;

        return new WeatherApiException(
            response.StatusCode,
            providerErrorCode,
            message,
            innerException);
    }
}