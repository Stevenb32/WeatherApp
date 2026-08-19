using System.Text.Json.Serialization;

namespace WeatherApp.Api.WeatherApi;

public sealed class WeatherApiErrorResponse
{
    [JsonPropertyName("error")]
    public WeatherApiError Error { get; set; } = new();
}

public sealed class WeatherApiError
{
    [JsonPropertyName("code")]
    public int Code { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}