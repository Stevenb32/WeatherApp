using System.Net;

namespace WeatherApp.Api.WeatherApi;

public sealed class WeatherApiException : Exception
{
    public WeatherApiException(
        HttpStatusCode statusCode,
        int? providerErrorCode,
        string message,
        Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
        ProviderErrorCode = providerErrorCode;
    }

    public HttpStatusCode StatusCode { get; }

    public int? ProviderErrorCode { get; }
}