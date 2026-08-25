namespace WeatherApp.Api.WeatherApi;

public class WeatherApiOptions
{
    public const string SectionName = "WeatherApi";

    public string BaseUrl { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(10);

    public TimeSpan CacheDuration { get; set; } = TimeSpan.FromMinutes(5);
}