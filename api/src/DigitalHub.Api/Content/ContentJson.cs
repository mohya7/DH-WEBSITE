using System.Text.Json;

namespace DigitalHub.Api.Content;

public static class ContentJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
