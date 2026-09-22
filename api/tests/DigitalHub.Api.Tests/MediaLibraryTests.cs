using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using DigitalHub.Images;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class MediaLibraryTests : IClassFixture<ApiFactory>
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static AuthSession? _editor;
    private static AuthSession? _admin;
    private static readonly Regex HashPath = new("^/media/[0-9a-f]{64}\\.webp$", RegexOptions.CultureInvariant);

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public MediaLibraryTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Upload_accepts_jpeg_png_and_webp_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var pngBytes = Encode(SKEncodedImageFormat.Png, 24, 18, 11);
        var jpegBytes = Encode(SKEncodedImageFormat.Jpeg, 24, 18, 22);
        var webpBytes = Encode(SKEncodedImageFormat.Webp, 24, 18, 33);
        await RemoveAsync(pngBytes);
        await RemoveAsync(jpegBytes);
        await RemoveAsync(webpBytes);
        var png = await UploadAsync(editor, pngBytes, "note.gif", "image/gif", "A png named as a gif");
        var jpeg = await UploadAsync(admin, jpegBytes, "photo.svg", "image/svg+xml", "A jpeg named as svg");
        var webp = await UploadAsync(editor, webpBytes, "picture.jpg", "image/jpeg", "A webp named as a jpeg");

        Assert.Equal(HttpStatusCode.Created, png.Status);
        Assert.Equal(HttpStatusCode.Created, jpeg.Status);
        Assert.Equal(HttpStatusCode.Created, webp.Status);
        Assert.Equal("image/webp", Text(png.Body, "contentType"));
        Assert.Equal("image/webp", Text(jpeg.Body, "contentType"));
        Assert.Matches(HashPath, Text(png.Body, "path"));
        Assert.Matches(HashPath, Text(jpeg.Body, "path"));
        Assert.DoesNotContain("svg", Text(jpeg.Body, "path"), StringComparison.OrdinalIgnoreCase);
        await DeleteMediaAsync(Id(png.Body));
        await DeleteMediaAsync(Id(jpeg.Body));
        await DeleteMediaAsync(Id(webp.Body));
    }

    [Fact]
    public async Task Upload_refuses_svg_and_anything_else()
    {
        var editor = await Editor();
        var admin = await Admin();
        var svg = """<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"""u8.ToArray();
        var xml = """<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>"""u8.ToArray();
        var gif = "GIF89a"u8.ToArray();

        var script = await UploadAsync(editor, svg, "photo.jpg", "image/jpeg", "Not an image");
        var declared = await UploadAsync(admin, xml, "picture.png", "image/png", "Still svg");
        var other = await UploadAsync(editor, gif, "anim.webp", "image/webp", "A gif");

        Assert.Equal(HttpStatusCode.BadRequest, script.Status);
        Assert.Equal("svg_refused", Code(script.Body));
        Assert.Equal(HttpStatusCode.BadRequest, declared.Status);
        Assert.Equal("svg_refused", Code(declared.Body));
        Assert.Equal(HttpStatusCode.BadRequest, other.Status);
        Assert.Equal("unsupported_type", Code(other.Body));
    }

    [Fact]
    public async Task Upload_refuses_an_image_over_the_pixel_cap_before_decoding()
    {
        var bomb = PngHeader(8_000, 4_000);
        var processed = ImagePipeline.Process(bomb);
        Assert.Equal("too_many_pixels", processed.Code);
        Assert.Equal(25_000_000, ImagePipeline.MaxPixels);

        var editor = await Editor();
        var admin = await Admin();
        var editorRefusal = await UploadAsync(editor, bomb, "huge.png", "image/png", "Too big");
        var adminRefusal = await UploadAsync(admin, bomb, "huge.png", "image/png", "Too big");
        Assert.Equal(HttpStatusCode.BadRequest, editorRefusal.Status);
        Assert.Equal("too_many_pixels", Code(editorRefusal.Body));
        Assert.Equal(HttpStatusCode.BadRequest, adminRefusal.Status);
        Assert.Equal("too_many_pixels", Code(adminRefusal.Body));

        var smallBytes = Encode(SKEncodedImageFormat.Png, 8, 8, 44);
        await RemoveAsync(smallBytes);
        var small = await UploadAsync(editor, smallBytes, "small.png", "image/png", "Under the cap");
        Assert.Equal(HttpStatusCode.Created, small.Status);
        await DeleteMediaAsync(Id(small.Body));
    }

    [Fact]
    public async Task Upload_stores_the_content_hash_and_keeps_the_uploaded_name_as_metadata()
    {
        var editor = await Editor();
        var bytes = Encode(SKEncodedImageFormat.Png, 32, 20, 55);
        await RemoveAsync(bytes);
        var processed = ImagePipeline.Process(bytes);
        Assert.True(processed.Succeeded);
        var uploaded = await UploadAsync(editor, bytes, "..\\..\\evil.svg", "image/svg+xml", "Named dangerously");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var body = JsonDocument.Parse(uploaded.Body).RootElement;
        var path = body.GetProperty("path").GetString()!;
        var original = body.GetProperty("originalName").GetString()!;
        Assert.Equal("/media/" + processed.Hash + ".webp", path);
        Assert.Matches(HashPath, path);
        Assert.DoesNotContain("evil", path, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\\", original, StringComparison.Ordinal);
        Assert.DoesNotContain("/", original, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(_factory.MediaRoot, "evil.svg")));
        Assert.Equal(processed.Webp, await File.ReadAllBytesAsync(Path.Combine(_factory.MediaRoot, processed.MainFileName)));

        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var id = body.GetProperty("id").GetGuid();
        var uploads = await database.AuditLog.CountAsync(entry => entry.EntityType == "media" && entry.EntityId == id.ToString() && entry.Action == "upload");
        Assert.Equal(1, uploads);
        await DeleteMediaAsync(id);
    }

    [Fact]
    public async Task Media_responses_send_nosniff_and_a_restrictive_content_security_policy()
    {
        var editor = await Editor();
        var admin = await Admin();
        var bytes = Encode(SKEncodedImageFormat.Png, 12, 12, 66);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "policy.png", "image/png", "For the policy check");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var path = Text(uploaded.Body, "path");

        var anonymous = await _client.GetAsync(path);
        var asAdmin = await _client.SendAsync(admin.Authorized(HttpMethod.Get, path));
        Assert.Equal(HttpStatusCode.OK, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.OK, asAdmin.StatusCode);
        Assert.Equal("image/webp", anonymous.Content.Headers.ContentType?.MediaType);
        AssertHeader(anonymous, "X-Content-Type-Options", "nosniff");
        AssertHeader(anonymous, "Content-Security-Policy", MediaLibrary.ContentSecurityPolicy);
        AssertHeader(asAdmin, "X-Content-Type-Options", "nosniff");
        AssertHeader(asAdmin, "Content-Security-Policy", MediaLibrary.ContentSecurityPolicy);
        await DeleteMediaAsync(Id(uploaded.Body));
    }

    [Fact]
    public async Task Upload_matches_the_shared_pipeline_the_importer_uses()
    {
        var bytes = Encode(SKEncodedImageFormat.Png, 900, 40, 77);
        await RemoveAsync(bytes);
        var first = ImagePipeline.Process(bytes);
        var second = ImagePipeline.Process(bytes);
        Assert.True(first.Succeeded);
        Assert.Equal(first.Webp, second.Webp);
        Assert.Equal(first.Variants.Select(variant => variant.Webp), second.Variants.Select(variant => variant.Webp));
        Assert.Contains(first.Variants, variant => variant.FileName == first.Hash + "-w640.webp");

        var editor = await Editor();
        var uploaded = await UploadAsync(editor, bytes, "wide.png", "image/png", "Wide enough for a variant");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        Assert.Equal(first.Hash, Text(uploaded.Body, "contentHash"));
        Assert.Equal(first.Webp, await File.ReadAllBytesAsync(Path.Combine(_factory.MediaRoot, first.MainFileName)));
        foreach (var variant in first.Variants)
            Assert.Equal(variant.Webp, await File.ReadAllBytesAsync(Path.Combine(_factory.MediaRoot, variant.FileName)));
        await DeleteMediaAsync(Id(uploaded.Body));
    }

    [Fact]
    public async Task Upload_requires_alt_text_unless_the_image_is_decorative()
    {
        var editor = await Editor();
        var bytes = Encode(SKEncodedImageFormat.Png, 10, 10, 88);
        await RemoveAsync(bytes);
        var missing = await UploadAsync(editor, bytes, "alt.png", "image/png", "   ");
        Assert.Equal(HttpStatusCode.BadRequest, missing.Status);
        Assert.Equal("validation_failed", Code(missing.Body));

        var decorative = await UploadAsync(editor, bytes, "alt.png", "image/png", null, decorative: true);
        Assert.Equal(HttpStatusCode.Created, decorative.Status);
        Assert.True(JsonDocument.Parse(decorative.Body).RootElement.GetProperty("decorative").GetBoolean());
        await DeleteMediaAsync(Id(decorative.Body));
    }

    [Fact]
    public async Task Upload_refuses_a_file_over_five_megabytes()
    {
        var editor = await Editor();
        var oversized = new byte[ImagePipeline.MaxBytes + 1];
        oversized[0] = 0xFF;
        var response = await UploadAsync(editor, oversized, "big.png", "image/png", "Too large");
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("too_large", Code(response.Body));
    }

    [Fact]
    public async Task List_search_and_edit_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var token = "harbour-" + Guid.NewGuid().ToString("N")[..8];
        var bytes = Encode(SKEncodedImageFormat.Png, 16, 16, 99);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, token + ".png", "image/png", token + " crane");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var id = Id(uploaded.Body);

        var editorList = await SendAsync(editor, HttpMethod.Get, "/api/v1/media?search=" + token);
        var adminList = await SendAsync(admin, HttpMethod.Get, "/api/v1/media?search=" + Uri.EscapeDataString(token + " crane"));
        Assert.Equal(HttpStatusCode.OK, editorList.Status);
        Assert.Equal(HttpStatusCode.OK, adminList.Status);
        Assert.Contains(id.ToString(), editorList.Body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(id.ToString(), adminList.Body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Get, "/api/v1/media/" + id)).Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Get, "/api/v1/media/" + id)).Status);

        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + id, new { alt = token + " crane revised", decorative = false });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        var caption = token + " evening";
        var captioned = await SendAsync(admin, HttpMethod.Put, "/api/v1/media/" + id, new { alt = token + " crane revised", decorative = false, caption });
        Assert.Equal(HttpStatusCode.OK, captioned.Status);
        var found = await SendAsync(admin, HttpMethod.Get, "/api/v1/media?search=" + Uri.EscapeDataString(caption));
        Assert.Contains(id.ToString(), found.Body, StringComparison.OrdinalIgnoreCase);

        var cleared = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + id, new { alt = "", decorative = false });
        Assert.Equal(HttpStatusCode.BadRequest, cleared.Status);
        Assert.Equal("validation_failed", Code(cleared.Body));
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(editor, HttpMethod.Get, "/api/v1/media/" + Guid.NewGuid())).Status);
        await DeleteMediaAsync(id);
    }

    [Fact]
    public async Task Delete_lists_every_place_and_an_editor_cannot_delete()
    {
        var editor = await Editor();
        var admin = await Admin();
        var bytes = Encode(SKEncodedImageFormat.Png, 18, 18, 111);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "used.png", "image/png", "Used in three places");
        var mediaId = Id(uploaded.Body);
        var pageSlug = "media-page-" + Guid.NewGuid().ToString("N")[..8];
        var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = pageSlug, title = "Media page", shareImageId = mediaId });
        Assert.Equal(HttpStatusCode.Created, page.Status);
        var pageId = Id(page.Body);
        var version = JsonDocument.Parse(page.Body).RootElement.GetProperty("version").GetInt32();
        var section = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + pageId + "/sections", new
        {
            version,
            type = "hero",
            fields = new
            {
                heading = "Hello",
                image = new { mediaId = mediaId.ToString(), alt = "Hero", decorative = false },
            },
        });
        Assert.Equal(HttpStatusCode.OK, section.Status);
        var sectionJson = JsonDocument.Parse(section.Body).RootElement;
        var sectionId = sectionJson.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid();
        var pageVersion = sectionJson.GetProperty("version").GetInt32();

        var blogSlug = "media-blog-" + Guid.NewGuid().ToString("N")[..8];
        var body = "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + mediaId + "\"}}]}";
        var blog = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new
        {
            slug = blogSlug,
            title = "Media blog",
            metaDescription = "A description for the blog.",
            fields = new { body },
        });
        Assert.Equal(HttpStatusCode.Created, blog.Status);
        var blogId = Id(blog.Body);
        var blogVersion = JsonDocument.Parse(blog.Body).RootElement.GetProperty("version").GetInt32();

        var editorDelete = await SendAsync(editor, HttpMethod.Delete, "/api/v1/media/" + mediaId);
        Assert.Equal(HttpStatusCode.Forbidden, editorDelete.Status);

        var blocked = await SendAsync(admin, HttpMethod.Delete, "/api/v1/media/" + mediaId);
        Assert.Equal(HttpStatusCode.Conflict, blocked.Status);
        Assert.Equal("in_use", Code(blocked.Body));
        var usages = JsonDocument.Parse(blocked.Body).RootElement.GetProperty("usages").EnumerateArray().Select(item => item.GetString()).ToList();
        Assert.Contains("pages " + pageId.ToString("D") + " share image", usages);
        Assert.Contains("pages " + pageId.ToString("D") + " section " + sectionId.ToString("D"), usages);
        Assert.Contains("blog-posts " + blogId.ToString("D") + " body", usages);

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/blog-posts/" + blogId + "?version=" + blogVersion)).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + pageId + "?version=" + pageVersion)).Status);
        var deleted = await SendAsync(admin, HttpMethod.Delete, "/api/v1/media/" + mediaId);
        Assert.Equal(HttpStatusCode.NoContent, deleted.Status);
        Assert.False(File.Exists(Path.Combine(_factory.MediaRoot, Text(uploaded.Body, "contentHash") + ".webp")));
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(admin, HttpMethod.Get, "/api/v1/media/" + mediaId)).Status);
    }

    [Fact]
    public async Task A_second_upload_of_the_same_bytes_returns_the_existing_image()
    {
        var editor = await Editor();
        var bytes = Encode(SKEncodedImageFormat.Png, 14, 14, 122);
        await RemoveAsync(bytes);
        var first = await UploadAsync(editor, bytes, "one.png", "image/png", "First copy");
        var second = await UploadAsync(editor, bytes, "two.png", "image/png", "Second copy");
        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.Equal(HttpStatusCode.OK, second.Status);
        Assert.Equal(Id(first.Body), Id(second.Body));
        Assert.True(JsonDocument.Parse(second.Body).RootElement.GetProperty("duplicate").GetBoolean());
        Assert.Equal("First copy", Text(second.Body, "alt"));
        await DeleteMediaAsync(Id(first.Body));
    }

    [Fact]
    public async Task Upload_is_limited_to_twenty_per_hour()
    {
        var bytes = Encode(SKEncodedImageFormat.Png, 6, 6, 133);
        await RemoveAsync(bytes);
        var session = await Limited();
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var response = await UploadAsync(session, bytes, "limit.png", "image/png", "Rate limit");
            Assert.True(response.Status is HttpStatusCode.Created or HttpStatusCode.OK, response.Body);
        }

        var blocked = await UploadAsync(session, bytes, "limit.png", "image/png", "Rate limit");
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.Status);
        Assert.Equal("rate_limited", Code(blocked.Body));
        Assert.Contains("Too many uploads.", blocked.Body, StringComparison.Ordinal);
        await RemoveAsync(bytes);
    }

    private static byte[] Encode(SKEncodedImageFormat format, int width, int height, byte red)
    {
        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque);
        using var bitmap = new SKBitmap(info);
        bitmap.Erase(new SKColor(red, 30, 90));
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, format == SKEncodedImageFormat.Jpeg ? 90 : 100);
        return data.ToArray();
    }

    private static byte[] PngHeader(int width, int height)
    {
        var bytes = new byte[24];
        bytes[0] = 137;
        bytes[1] = 80;
        bytes[2] = 78;
        bytes[3] = 71;
        bytes[4] = 13;
        bytes[5] = 10;
        bytes[6] = 26;
        bytes[7] = 10;
        bytes[11] = 13;
        bytes[12] = (byte)'I';
        bytes[13] = (byte)'H';
        bytes[14] = (byte)'D';
        bytes[15] = (byte)'R';
        bytes[16] = (byte)(width >> 24);
        bytes[17] = (byte)(width >> 16);
        bytes[18] = (byte)(width >> 8);
        bytes[19] = (byte)width;
        bytes[20] = (byte)(height >> 24);
        bytes[21] = (byte)(height >> 16);
        bytes[22] = (byte)(height >> 8);
        bytes[23] = (byte)height;
        return bytes;
    }

    private async Task RemoveAsync(byte[] bytes)
    {
        var processed = ImagePipeline.Process(bytes);
        if (!processed.Succeeded)
            return;
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var asset = await database.Media.FirstOrDefaultAsync(item => item.ContentHash == processed.Hash);
        if (asset is not null)
            await DeleteMediaAsync(asset.Id);
    }

    private async Task DeleteMediaAsync(Guid id)
    {
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/media/" + id);
        Assert.True(response.Status is HttpStatusCode.NoContent or HttpStatusCode.NotFound);
    }

    private async Task<(HttpStatusCode Status, string Body)> UploadAsync(AuthSession session, byte[] bytes, string fileName, string mediaType, string? alt, bool decorative = false)
    {
        var request = session.Authorized(HttpMethod.Post, "/api/v1/media");
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(mediaType);
        form.Add(file, "file", fileName);
        if (alt is not null)
            form.Add(new StringContent(alt), "alt");
        form.Add(new StringContent(decorative ? "true" : "false"), "decorative");
        request.Content = form;
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static void AssertHeader(HttpResponseMessage response, string name, string expected)
    {
        Assert.True(response.Headers.TryGetValues(name, out var values) || response.Content.Headers.TryGetValues(name, out values));
        Assert.Equal(expected, values!.Single());
    }

    private static string Code(string body) => JsonDocument.Parse(body).RootElement.GetProperty("code").GetString()!;

    private static string Text(string body, string name) => JsonDocument.Parse(body).RootElement.GetProperty(name).GetString()!;

    private static Guid Id(string body) => JsonDocument.Parse(body).RootElement.GetProperty("id").GetGuid();

    private async Task<AuthSession> Editor() => await Session("media-editor@digitalhub.test", "editor", static () => _editor, value => _editor = value);

    private async Task<AuthSession> Admin() => await Session(ApiFactory.AdminEmail, "admin", static () => _admin, value => _admin = value, ApiFactory.AdminPassword);

    private async Task<AuthSession> Limited()
    {
        const string email = "media-limited@digitalhub.test";
        await CreateUserAsync(email, "editor");
        var session = await AuthSession.LoginAsync(_client, email, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    private async Task<AuthSession> Session(string email, string role, Func<AuthSession?> read, Action<AuthSession> write, string? password = null)
    {
        await Gate.WaitAsync();
        try
        {
            var existing = read();
            if (existing is not null)
                return existing;
            if (role != "admin")
                await CreateUserAsync(email, role);
            var session = await AuthSession.LoginAsync(_client, email, password ?? ApiFactory.AdminPassword);
            Assert.Equal(HttpStatusCode.OK, session.Status);
            write(session);
            return session;
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task CreateUserAsync(string email, string role)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await users.FindByEmailAsync(email) is not null)
            return;
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        Assert.True((await users.CreateAsync(user, ApiFactory.AdminPassword)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
    }
}
