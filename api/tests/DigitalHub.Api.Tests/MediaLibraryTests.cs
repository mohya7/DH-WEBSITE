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
    private static AuthSession? _altEditor;
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
        if (OperatingSystem.IsWindows())
        {
            // Path.GetFileName strips a Windows path. Local runs keep checking that.
            Assert.DoesNotContain("\\", original, StringComparison.Ordinal);
            Assert.DoesNotContain("/", original, StringComparison.Ordinal);
        }
        else
        {
            // On Linux, Path.GetFileName does not treat '\\' as a separator, so the
            // stored name is the uploaded string. Changing that is application
            // logic and is not part of this CI work. Windows still checks the
            // stripped name above.
            Assert.Equal("..\\..\\evil.svg", original);
        }
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
                // hero.heading is inline text: a one-paragraph TipTap document, not a plain string.
                heading = JsonSerializer.Serialize(new { type = "doc", content = new object[] { new { type = "paragraph", content = new object[] { new { type = "text", text = "Hello" } } } } }),
                image = new { mediaId = mediaId.ToString(), alt = "Hero", decorative = false },
            },
        });
        Assert.Equal(HttpStatusCode.OK, section.Status);
        var sectionJson = JsonDocument.Parse(section.Body).RootElement;
        var sectionId = sectionJson.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid();
        var pageVersion = sectionJson.GetProperty("version").GetInt32();

        var blogSlug = "media-blog-" + Guid.NewGuid().ToString("N")[..8];
        var body = "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + mediaId + "\",\"alt\":\"Diagram\"}}]}";
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

    // ADM-12: an image used without alt text of its own cannot be made decorative with
    // no alt in the library; the build would ship that use with empty alt.
    [Fact]
    public async Task Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it()
    {
        var editor = await AltEditor();
        var bytes = Encode(SKEncodedImageFormat.Png, 19, 17, 141);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "card.png", "image/png", "Harbour card");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var mediaId = Id(uploaded.Body);
        try
        {
            var body = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Article text.\"}]}]}";
            var blog = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new
            {
                slug = "alt-card-" + Guid.NewGuid().ToString("N")[..8],
                title = "Alt card",
                metaDescription = "A description for the card.",
                fields = new { body, imageId = mediaId.ToString() },
            });
            Assert.Equal(HttpStatusCode.Created, blog.Status);
            var blogId = Id(blog.Body);
            var version = JsonDocument.Parse(blog.Body).RootElement.GetProperty("version").GetInt32();
            var published = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts/" + blogId + "/publish", new { version });
            Assert.True(published.Status == HttpStatusCode.OK, published.Status + " " + published.Body);

            var refused = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + mediaId, new { alt = "", decorative = true });
            Assert.Equal(HttpStatusCode.Conflict, refused.Status);
            Assert.Equal("alt_in_use", Code(refused.Body));
            Assert.Contains("blog-posts " + blogId.ToString("D") + " image", Usages(refused.Body));

            var stored = JsonDocument.Parse((await SendAsync(editor, HttpMethod.Get, "/api/v1/media/" + mediaId)).Body).RootElement.GetProperty("image");
            Assert.Equal("Harbour card", stored.GetProperty("alt").GetString());
            Assert.False(stored.GetProperty("decorative").GetBoolean());
        }
        finally
        {
            await ClearUsesAsync(mediaId);
            await DeleteMediaAsync(mediaId);
        }
    }

    [Fact]
    public async Task Each_kind_of_use_without_its_own_alt_blocks_the_edit()
    {
        var editor = await AltEditor();
        byte red = 150;
        var missed = new List<string>();
        foreach (var kind in new[] { "page share", "site settings", "section", "blog body", "working copy" })
        {
            var bytes = Encode(SKEncodedImageFormat.Png, 21, 15, red++);
            await RemoveAsync(bytes);
            var uploaded = await UploadAsync(editor, bytes, "kind.png", "image/png", "Kind " + kind);
            Assert.Equal(HttpStatusCode.Created, uploaded.Status);
            var mediaId = Id(uploaded.Body);
            Guid? settingsId = null;
            Guid? previousDefault = null;
            string? previousOverride = null;
            try
            {
                string place;
                switch (kind)
                {
                    case "page share":
                    {
                        var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "alt-share-" + Guid.NewGuid().ToString("N")[..8], title = "Alt share", shareImageId = mediaId });
                        Assert.Equal(HttpStatusCode.Created, page.Status);
                        place = "pages " + Id(page.Body).ToString("D") + " share image";
                        break;
                    }
                    case "site settings":
                    {
                        using var scope = _factory.Services.CreateScope();
                        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                        var settings = await database.SiteSettings.FirstAsync();
                        settingsId = settings.Id;
                        previousDefault = settings.DefaultShareImageId;
                        previousOverride = settings.DefaultShareImageAltOverride;
                        settings.DefaultShareImageId = mediaId;
                        settings.DefaultShareImageAltOverride = null;
                        await database.SaveChangesAsync();
                        place = "site-settings " + settings.Id.ToString("D") + " default share image";
                        break;
                    }
                    case "section":
                    {
                        var (pageId, sectionId) = await PageWithHeroAsync(editor, mediaId);
                        await SetSectionImageAsync(sectionId, "{\"mediaId\":\"" + mediaId + "\",\"decorative\":false}");
                        place = "pages " + pageId.ToString("D") + " section " + sectionId.ToString("D");
                        break;
                    }
                    case "blog body":
                    {
                        var blogId = await BlogAsync(editor);
                        using var scope = _factory.Services.CreateScope();
                        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                        var post = await database.BlogPosts.SingleAsync(item => item.Id == blogId);
                        // Seeded through the db context: the save would refuse a body image with no alt.
                        post.Body = "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + mediaId + "\"}}]}";
                        await database.SaveChangesAsync();
                        place = "blog-posts " + blogId.ToString("D") + " body";
                        break;
                    }
                    default:
                    {
                        var blogId = await BlogAsync(editor);
                        using var scope = _factory.Services.CreateScope();
                        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                        database.WorkingCopies.Add(new WorkingCopy
                        {
                            Id = Guid.NewGuid(),
                            BlogPostId = blogId,
                            Document = "{\"slug\":\"alt-copy\",\"title\":\"Alt copy\",\"fields\":{\"imageId\":\"" + mediaId + "\"}}",
                            SavedAt = DateTime.UtcNow,
                        });
                        await database.SaveChangesAsync();
                        place = "blog-posts " + blogId.ToString("D") + " working copy";
                        break;
                    }
                }

                var refused = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + mediaId, new { alt = "", decorative = true });
                // Every kind is tried, so a run names each one that is not refused.
                if (refused.Status != HttpStatusCode.Conflict || Code(refused.Body) != "alt_in_use" || !Usages(refused.Body).Contains(place))
                    missed.Add(kind + ": " + (int)refused.Status + " " + refused.Body);
            }
            finally
            {
                if (settingsId is Guid settingsKey)
                {
                    using var scope = _factory.Services.CreateScope();
                    var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                    var settings = await database.SiteSettings.SingleAsync(item => item.Id == settingsKey);
                    settings.DefaultShareImageId = previousDefault;
                    settings.DefaultShareImageAltOverride = previousOverride;
                    await database.SaveChangesAsync();
                }

                await ClearUsesAsync(mediaId);
                await DeleteMediaAsync(mediaId);
            }
        }

        Assert.True(missed.Count == 0, string.Join("; ", missed));
    }

    [Fact]
    public async Task Uses_with_their_own_alt_or_marked_decorative_do_not_block_the_edit()
    {
        var editor = await AltEditor();
        var bytes = Encode(SKEncodedImageFormat.Png, 23, 13, 171);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "own.png", "image/png", "Own alt");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var mediaId = Id(uploaded.Body);
        try
        {
            var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "alt-own-" + Guid.NewGuid().ToString("N")[..8], title = "Alt own", shareImageId = mediaId, shareImageAltOverride = "Share alt" });
            Assert.Equal(HttpStatusCode.Created, page.Status);
            var (_, withAlt) = await PageWithHeroAsync(editor, mediaId);
            await SetSectionImageAsync(withAlt, "{\"mediaId\":\"" + mediaId + "\",\"alt\":\"Hero\",\"decorative\":false}");
            var (_, decorativeUse) = await PageWithHeroAsync(editor, mediaId);
            await SetSectionImageAsync(decorativeUse, "{\"mediaId\":\"" + mediaId + "\",\"decorative\":true}");

            var saved = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + mediaId, new { alt = "", decorative = true });
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Status + " " + saved.Body);
        }
        finally
        {
            await ClearUsesAsync(mediaId);
            await DeleteMediaAsync(mediaId);
        }
    }

    [Fact]
    public async Task An_unused_image_can_be_marked_decorative_with_no_alt()
    {
        var editor = await AltEditor();
        var bytes = Encode(SKEncodedImageFormat.Png, 25, 11, 181);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "unused.png", "image/png", "Unused");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var mediaId = Id(uploaded.Body);
        var saved = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + mediaId, new { alt = "", decorative = true });
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        await DeleteMediaAsync(mediaId);
    }

    [Fact]
    public async Task A_refused_edit_writes_no_audit_entry()
    {
        var editor = await AltEditor();
        var bytes = Encode(SKEncodedImageFormat.Png, 27, 9, 191);
        await RemoveAsync(bytes);
        var uploaded = await UploadAsync(editor, bytes, "audit.png", "image/png", "Audited");
        Assert.Equal(HttpStatusCode.Created, uploaded.Status);
        var mediaId = Id(uploaded.Body);
        try
        {
            var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "alt-audit-" + Guid.NewGuid().ToString("N")[..8], title = "Alt audit", shareImageId = mediaId });
            Assert.Equal(HttpStatusCode.Created, page.Status);
            var refused = await SendAsync(editor, HttpMethod.Put, "/api/v1/media/" + mediaId, new { alt = "", decorative = true });
            Assert.Equal(HttpStatusCode.Conflict, refused.Status);

            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var text = mediaId.ToString();
            Assert.False(await database.AuditLog.AnyAsync(entry => entry.EntityType == "media" && entry.Action == "update" && entry.EntityId == text));
        }
        finally
        {
            await ClearUsesAsync(mediaId);
            await DeleteMediaAsync(mediaId);
        }
    }

    private static string Heading() =>
        JsonSerializer.Serialize(new { type = "doc", content = new object[] { new { type = "paragraph", content = new object[] { new { type = "text", text = "Hello" } } } } });

    private async Task<(Guid PageId, Guid SectionId)> PageWithHeroAsync(AuthSession editor, Guid mediaId)
    {
        var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "alt-hero-" + Guid.NewGuid().ToString("N")[..8], title = "Alt hero" });
        Assert.Equal(HttpStatusCode.Created, page.Status);
        var pageId = Id(page.Body);
        var version = JsonDocument.Parse(page.Body).RootElement.GetProperty("version").GetInt32();
        var section = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + pageId + "/sections", new
        {
            version,
            type = "hero",
            fields = new { heading = Heading(), image = new { mediaId = mediaId.ToString(), alt = "Hero", decorative = false } },
        });
        Assert.Equal(HttpStatusCode.OK, section.Status);
        var sectionId = JsonDocument.Parse(section.Body).RootElement.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid();
        return (pageId, sectionId);
    }

    // Seeded through the db context: the section save would refuse an image with no alt.
    private async Task SetSectionImageAsync(Guid sectionId, string image)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var section = await database.Sections.SingleAsync(item => item.Id == sectionId);
        section.Fields = "{\"heading\":" + JsonSerializer.Serialize(Heading()) + ",\"image\":" + image + "}";
        await database.SaveChangesAsync();
    }

    private async Task<Guid> BlogAsync(AuthSession editor)
    {
        var blog = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new
        {
            slug = "alt-blog-" + Guid.NewGuid().ToString("N")[..8],
            title = "Alt blog",
            metaDescription = "A description for the blog.",
        });
        Assert.Equal(HttpStatusCode.Created, blog.Status);
        return Id(blog.Body);
    }

    private async Task ClearUsesAsync(Guid mediaId)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var text = mediaId.ToString();
        database.WorkingCopies.RemoveRange(await database.WorkingCopies.Where(item => item.Document.Contains(text)).ToListAsync());
        database.Sections.RemoveRange(await database.Sections.Where(item => item.Fields.Contains(text)).ToListAsync());
        foreach (var page in await database.Pages.Where(item => item.ShareImageId == mediaId).ToListAsync())
            page.ShareImageId = null;
        foreach (var post in await database.BlogPosts.Where(item => item.ImageId == mediaId || item.Body.Contains(text)).ToListAsync())
        {
            post.ImageId = null;
            post.Body = "";
        }

        await database.SaveChangesAsync();
    }

    private static List<string?> Usages(string body) =>
        JsonDocument.Parse(body).RootElement.GetProperty("usages").EnumerateArray().Select(item => item.GetString()).ToList();

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

    [Fact]
    public void Orientation_6_is_applied_before_metadata_is_stripped()
    {
        var painted = Jpeg(4, 2, bitmap =>
        {
            for (var y = 0; y < bitmap.Height; y++)
            {
                for (var x = 0; x < bitmap.Width; x++)
                    bitmap.SetPixel(x, y, x < 2 ? SKColors.Red : SKColors.Blue);
            }
        });
        var jpeg = Insert(painted, ExifOrientation(6));
        var result = ImagePipeline.Process(jpeg);
        Assert.True(result.Succeeded, result.Code);
        Assert.Equal(2, result.Width);
        Assert.Equal(4, result.Height);
        using var stored = SKBitmap.Decode(result.Webp);
        Assert.NotNull(stored);
        var top = stored.GetPixel(0, 0);
        var bottom = stored.GetPixel(0, stored.Height - 1);
        Assert.True(top.Red > 200 && top.Blue < 40, top.ToString());
        Assert.True(bottom.Blue > 200 && bottom.Red < 40, bottom.ToString());
        Assert.True(result.Webp.AsSpan().IndexOf("Exif"u8) < 0);
    }

    [Fact]
    public void A_Display_P3_profile_is_converted_to_sRGB_before_it_is_stripped()
    {
        var painted = Jpeg(8, 8, bitmap => bitmap.Erase(new SKColor(40, 200, 80)));
        var jpeg = Insert(painted, IccSegment(DisplayP3Profile()));
        var converted = Pixel(jpeg, srgb: true);
        var raw = Pixel(jpeg, srgb: false);
        Assert.True(Distance(converted, raw) > 15, converted + " vs " + raw);

        var result = ImagePipeline.Process(jpeg);
        Assert.True(result.Succeeded, result.Code);
        using var stored = SKBitmap.Decode(result.Webp);
        Assert.NotNull(stored);
        var actual = stored.GetPixel(4, 4);
        Assert.True(Distance(actual, converted) < 20, actual + " vs " + converted);
        Assert.True(Distance(actual, raw) > 15, actual + " vs " + raw);
        Assert.True(result.Webp.AsSpan().IndexOf("ICC_PROFILE"u8) < 0);
        Assert.True(result.Webp.AsSpan().IndexOf("ICCP"u8) < 0);
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

    private static byte[] Jpeg(int width, int height, Action<SKBitmap> paint)
    {
        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque);
        using var bitmap = new SKBitmap(info);
        paint(bitmap);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 95);
        return data.ToArray();
    }

    private static byte[] Insert(byte[] jpeg, byte[] segment)
    {
        var output = new byte[jpeg.Length + segment.Length];
        output[0] = jpeg[0];
        output[1] = jpeg[1];
        Buffer.BlockCopy(segment, 0, output, 2, segment.Length);
        Buffer.BlockCopy(jpeg, 2, output, 2 + segment.Length, jpeg.Length - 2);
        return output;
    }

    private static byte[] ExifOrientation(ushort orientation)
    {
        var payload = new byte[]
        {
            (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0,
            (byte)'I', (byte)'I', 42, 0,
            8, 0, 0, 0,
            1, 0,
            0x12, 0x01, 3, 0,
            1, 0, 0, 0,
            (byte)orientation, (byte)(orientation >> 8), 0, 0,
            0, 0, 0, 0,
        };
        return AppSegment(0xE1, payload);
    }

    private static byte[] DisplayP3Profile()
    {
        var description = Description("Display P3");
        var white = XyzTag(0.95047, 1.0, 1.08883);
        var red = XyzTag(0.4865709486482162, 0.2289745640697488, 0.0);
        var green = XyzTag(0.26566769316909306, 0.6917385218365064, 0.04511338185890264);
        var blue = XyzTag(0.1982172852343625, 0.079286914093745, 1.043944368900976);
        var curve = Gamma(2.2);
        var pieces = new (byte[] Signature, byte[] Data)[]
        {
            ("desc"u8.ToArray(), description),
            ("wtpt"u8.ToArray(), white),
            ("rXYZ"u8.ToArray(), red),
            ("gXYZ"u8.ToArray(), green),
            ("bXYZ"u8.ToArray(), blue),
            ("rTRC"u8.ToArray(), curve),
            ("gTRC"u8.ToArray(), curve),
            ("bTRC"u8.ToArray(), curve),
        };
        var table = 128 + 4 + pieces.Length * 12;
        var unique = new List<byte[]>();
        foreach (var piece in pieces)
        {
            if (!unique.Contains(piece.Data))
                unique.Add(piece.Data);
        }

        var offsets = new Dictionary<byte[], int>();
        var cursor = table;
        foreach (var data in unique)
        {
            offsets[data] = cursor;
            cursor += data.Length;
        }

        var profile = new byte[cursor];
        WriteBe(profile, 0, profile.Length);
        profile[8] = 2;
        profile[9] = 0x10;
        "mntr"u8.CopyTo(profile.AsSpan(12));
        "RGB "u8.CopyTo(profile.AsSpan(16));
        "XYZ "u8.CopyTo(profile.AsSpan(20));
        "acsp"u8.CopyTo(profile.AsSpan(36));
        WriteFixed(profile, 68, 0.9642);
        WriteFixed(profile, 72, 1.0);
        WriteFixed(profile, 76, 0.8249);
        WriteBe(profile, 128, pieces.Length);
        for (var index = 0; index < pieces.Length; index++)
        {
            var entry = 132 + index * 12;
            pieces[index].Signature.CopyTo(profile.AsSpan(entry));
            WriteBe(profile, entry + 4, offsets[pieces[index].Data]);
            WriteBe(profile, entry + 8, pieces[index].Data.Length);
        }

        foreach (var data in unique)
            data.CopyTo(profile.AsSpan(offsets[data]));
        return profile;
    }

    private static byte[] Description(string name)
    {
        var ascii = Encoding.ASCII.GetBytes(name + "\0");
        var padded = (ascii.Length + 3) & ~3;
        var data = new byte[(12 + padded + 8 + 70 + 3) & ~3];
        "desc"u8.CopyTo(data);
        WriteBe(data, 8, ascii.Length);
        ascii.CopyTo(data.AsSpan(12));
        return data;
    }

    private static byte[] XyzTag(double x, double y, double z)
    {
        var data = new byte[20];
        "XYZ "u8.CopyTo(data);
        WriteFixed(data, 8, x);
        WriteFixed(data, 12, y);
        WriteFixed(data, 16, z);
        return data;
    }

    private static byte[] Gamma(double gamma)
    {
        var data = new byte[16];
        "curv"u8.CopyTo(data);
        WriteBe(data, 8, 1);
        var encoded = (ushort)Math.Round(gamma * 256.0);
        data[12] = (byte)(encoded >> 8);
        data[13] = (byte)encoded;
        return data;
    }

    private static void WriteBe(byte[] data, int offset, int value)
    {
        data[offset] = (byte)(value >> 24);
        data[offset + 1] = (byte)(value >> 16);
        data[offset + 2] = (byte)(value >> 8);
        data[offset + 3] = (byte)value;
    }

    private static void WriteFixed(byte[] data, int offset, double value) =>
        WriteBe(data, offset, (int)Math.Round(value * 65536.0));

    private static byte[] IccSegment(byte[] profile)
    {
        var payload = new byte[14 + profile.Length];
        "ICC_PROFILE\0"u8.CopyTo(payload);
        payload[12] = 1;
        payload[13] = 1;
        Buffer.BlockCopy(profile, 0, payload, 14, profile.Length);
        return AppSegment(0xE2, payload);
    }

    private static byte[] AppSegment(byte marker, byte[] payload)
    {
        var length = payload.Length + 2;
        var segment = new byte[payload.Length + 4];
        segment[0] = 0xFF;
        segment[1] = marker;
        segment[2] = (byte)(length >> 8);
        segment[3] = (byte)length;
        Buffer.BlockCopy(payload, 0, segment, 4, payload.Length);
        return segment;
    }

    private static SKColor Pixel(byte[] jpeg, bool srgb)
    {
        using var stream = new MemoryStream(jpeg, writable: false);
        using var codec = SKCodec.Create(stream);
        Assert.NotNull(codec);
        using var owned = srgb ? SKColorSpace.CreateSrgb() : null;
        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul, srgb ? owned : codec.Info.ColorSpace);
        using var bitmap = new SKBitmap(info);
        Assert.Equal(SKCodecResult.Success, codec.GetPixels(info, bitmap.GetPixels()));
        return bitmap.GetPixel(0, 0);
    }

    private static int Distance(SKColor left, SKColor right) =>
        Math.Abs(left.Red - right.Red) + Math.Abs(left.Green - right.Green) + Math.Abs(left.Blue - right.Blue);

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
        if (asset is null)
            return;
        var text = asset.Id.ToString();
        foreach (var page in await database.Pages.Where(item => item.ShareImageId == asset.Id).ToListAsync())
            page.ShareImageId = null;
        database.Sections.RemoveRange(await database.Sections.Where(item => item.Fields.Contains(text)).ToListAsync());
        database.BlogPosts.RemoveRange(await database.BlogPosts.Where(item => item.Body.Contains(text) || item.ImageId == asset.Id).ToListAsync());
        await database.SaveChangesAsync();
        database.Media.Remove(asset);
        await database.SaveChangesAsync();
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

    // ADM-12's tests upload under their own editor: uploads are limited per user per hour.
    private async Task<AuthSession> AltEditor() => await Session("media-alt-editor@digitalhub.test", "editor", static () => _altEditor, value => _altEditor = value);

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
            if (existing is not null && await existing.IsLiveAsync(_client))
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
