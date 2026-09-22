namespace DigitalHub.Api.Content;

public static class ContentPaths
{
    public static string? PublicPath(string collection, string slug) => collection switch
    {
        "pages" => slug switch
        {
            "home" => "/",
            "about" => "/about",
            "contact" => "/contact",
            "apply" => "/careers/apply",
            _ => "/" + slug,
        },
        "services" => "/services/" + slug,
        "partners" => "/partners/" + slug,
        "case-studies" => "/cases/" + slug,
        "blog-posts" => "/blogs/" + slug,
        "vacancies" => "/careers/" + slug,
        "news-items" => null,
        "team-members" => null,
        _ => null,
    };
}
