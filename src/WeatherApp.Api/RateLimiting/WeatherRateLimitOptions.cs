namespace WeatherApp.Api.RateLimiting;

public sealed class WeatherRateLimitOptions
{
    public const string SectionName = "WeatherRateLimit";

    public int PermitLimit { get; set; }

    public TimeSpan Window { get; set; }
}