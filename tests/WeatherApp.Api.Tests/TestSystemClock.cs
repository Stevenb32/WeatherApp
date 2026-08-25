using Microsoft.Extensions.Internal;

namespace WeatherApp.Api.Tests;

internal sealed class TestSystemClock : ISystemClock
{
    public TestSystemClock(DateTimeOffset utcNow)
    {
        UtcNow = utcNow;
    }

    public DateTimeOffset UtcNow { get; private set; }

    public void Advance(TimeSpan duration)
    {
        UtcNow = UtcNow.Add(duration);
    }
}