using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Infrastructure;

public sealed class SensitiveDestructuringPolicy : IDestructuringPolicy
{
    private static readonly HashSet<string> Names = new(StringComparer.OrdinalIgnoreCase)
    {
        "password",
        "token",
        "secret",
        "authorization",
        "refreshToken",
        "connectionString",
        "signingKey",
    };

    public bool TryDestructure(object value, ILogEventPropertyValueFactory propertyValueFactory, out LogEventPropertyValue result)
    {
        var properties = value.GetType().GetProperties();
        if (properties.Length == 0)
        {
            result = null!;
            return false;
        }

        var rewritten = new List<LogEventProperty>(properties.Length);
        var touched = false;
        foreach (var property in properties)
        {
            if (!property.CanRead || property.GetIndexParameters().Length > 0)
            {
                continue;
            }

            if (Names.Contains(property.Name))
            {
                touched = true;
                rewritten.Add(new LogEventProperty(property.Name, new ScalarValue("[redacted]")));
                continue;
            }

            object? propertyValue;
            try
            {
                propertyValue = property.GetValue(value);
            }
            catch
            {
                continue;
            }

            rewritten.Add(new LogEventProperty(property.Name, propertyValueFactory.CreatePropertyValue(propertyValue, true)));
        }

        if (!touched)
        {
            result = null!;
            return false;
        }

        result = new StructureValue(rewritten);
        return true;
    }
}
