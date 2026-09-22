using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AngleSharp.Dom;
using DigitalHub.Api.Data;

namespace DigitalHub.ContentImport;

static partial class ContentWriter
{
    private static readonly List<SectionProbe> Probes = [];

    private static JsonObject Extract(string type, IElement section, string fromPage, Dictionary<string, MediaAsset> media, ImportModel model, List<string> warnings, List<string> notes)
    {
        return type switch
        {
            "hero" => Hero(section, fromPage, media, warnings),
            "hub_hero" => HubHero(section),
            "service_hero" => ServiceHero(section, fromPage),
            "service_cards" => ServiceCards(section, fromPage, warnings),
            "feature_grid" => FeatureGrid(section, fromPage, media, warnings),
            "delivery_flow" => DeliveryFlow(section),
            "logo_bar" => LogoBar(section, fromPage, media, warnings),
            "stats" => Stats(section),
            "partner_grid" => PartnerGrid(section, fromPage, media, warnings),
            "case_cards" => CaseCards(section, fromPage, media, warnings),
            "news_carousel" => NewsCarousel(section, fromPage, media, warnings),
            "blog_list" => BlogList(section, fromPage, media, warnings),
            "vacancy_list" => VacancyList(section, notes),
            "values" => Values(section, fromPage, media, warnings),
            "call_to_action" => CallToAction(section, fromPage),
            "contact_details" => ContactDetails(section, fromPage, notes),
            "timeline" => Timeline(section, fromPage, media, warnings),
            "pillars" => TitledPairs(section, "article.about-pillar"),
            "profile" => Profile(section, fromPage, media, warnings),
            "team_grid" => TeamGrid(section, fromPage, media, warnings),
            "problem" => Problem(section),
            "methodology" => Methodology(section, fromPage, media, warnings),
            "industries" => TitledPairs(section, "article.industry-card"),
            "rich_text" => Prose(section),
            "related_items" => RelatedItems(section, fromPage, media, model, warnings, notes),
            "partner_overview" => PartnerOverview(section, fromPage),
            "partner_focus" => TitledPairs(section, "article.partner-focus-card"),
            _ => new JsonObject(),
        };
    }

    private static JsonObject Hero(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var classes = section.ClassName ?? "";
        if (classes.Contains("partner-view-hero", StringComparison.Ordinal))
            return PartnerHero(section, fromPage, media, warnings);
        if (classes.Contains("cs-hero", StringComparison.Ordinal))
            return CaseHero(section, fromPage, media, warnings);
        if (classes.Contains("about-hero", StringComparison.Ordinal))
            return AboutHero(section, fromPage);
        return HomeHero(section, fromPage, media, warnings);
    }

    private static JsonObject HomeHero(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", section.QuerySelector(".eyebrow span:not([aria-hidden])")?.TextContent);
        Put(fields, "lead", section.QuerySelector(".hero-sub")?.TextContent);
        var logos = new JsonArray();
        foreach (var anchor in section.QuerySelectorAll(".partner-logos a"))
        {
            var logo = new JsonObject();
            var image = MediaOf(anchor.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                logo["image"] = image;
            var href = Href(anchor, fromPage);
            if (href.Length > 0)
                logo["href"] = href;
            var reference = ReferenceOf(anchor, fromPage);
            if (reference is not null)
                logo["reference"] = reference;
            if (logo.Count > 0)
                logos.Add(logo);
        }

        Put(fields, "logos", logos);
        return fields;
    }

    private static JsonObject AboutHero(IElement section, string fromPage)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", Eyebrow(section));
        Put(fields, "lead", section.QuerySelector(".about-lede, .lead")?.TextContent);
        var actions = new JsonArray();
        foreach (var anchor in section.QuerySelectorAll(".about-hero__cta a"))
        {
            var link = LinkOf(anchor, fromPage);
            if (link is not null)
                actions.Add(link);
        }

        Put(fields, "actions", actions);
        var proof = new JsonArray();
        foreach (var item in section.QuerySelectorAll(".about-proof li"))
        {
            proof.Add(new JsonObject
            {
                ["value"] = Text(item.QuerySelector("strong")),
                ["label"] = Text(item.QuerySelector("span")),
            });
        }

        Put(fields, "proof", proof);
        return fields;
    }

    private static JsonObject CaseHero(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", Eyebrow(section));
        Put(fields, "client", section.QuerySelector(".cs-hero__client")?.TextContent);
        var tags = Strings(section.QuerySelectorAll(".cs-tag").Select(tag => tag.TextContent));
        Put(fields, "tags", tags);
        var image = MediaOf(section.QuerySelector(".cs-hero__media img"), fromPage, media, warnings);
        if (image is not null)
            fields["image"] = image;
        return fields;
    }

    private static JsonObject PartnerHero(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        var back = LinkOf(section.QuerySelector(".partner-view-back"), fromPage);
        if (back is not null)
            fields["back"] = back;
        Put(fields, "kicker", section.QuerySelector(".partner-view-tag")?.TextContent);
        Put(fields, "lead", section.QuerySelector(".partner-view-lead")?.TextContent);
        var image = MediaOf(section.QuerySelector(".partner-view-logo img"), fromPage, media, warnings);
        if (image is not null)
            fields["image"] = image;
        return fields;
    }

    private static JsonObject HubHero(IElement section)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", Eyebrow(section));
        Put(fields, "lead", section.QuerySelector(".lead")?.TextContent);
        return fields;
    }

    private static JsonObject ServiceHero(IElement section, string fromPage)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", section.QuerySelector(".svc-eyebrow")?.TextContent);
        Put(fields, "lead", section.QuerySelector(".svc-lede")?.TextContent);
        var action = LinkOf(section.QuerySelector(".svc-cta-row a"), fromPage);
        if (action is not null)
            fields["action"] = action;
        Put(fields, "marks", Strings(section.QuerySelectorAll(".svc-hero-marks li").Select(item => item.TextContent)));
        return fields;
    }

    private static JsonObject ServiceCards(IElement section, string fromPage, List<string> warnings)
    {
        _ = warnings;
        if (section.QuerySelector("article.svc-card") is not null)
            return HomeServiceCards(section, fromPage);
        return AboutServiceCards(section, fromPage);
    }

    private static JsonObject HomeServiceCards(IElement section, string fromPage)
    {
        var fields = Headed(section);
        var items = new JsonArray();
        foreach (var card in section.QuerySelectorAll("article.svc-card"))
        {
            var item = new JsonObject { ["title"] = Text(card.QuerySelector("h3")) };
            Put(item, "text", card.QuerySelector("p")?.TextContent);
            var action = LinkOf(card.QuerySelector("a[href]"), fromPage);
            if (action is not null)
                item["action"] = action;
            var reference = ReferenceOf(card.QuerySelector("a[href]"), fromPage);
            if (reference is not null)
                item["reference"] = reference;
            var marks = VisibleFragments(card.QuerySelector(".svc-card__visual"));
            if (marks.Count > 0)
                item["marks"] = Strings(marks);
            items.Add(item);
        }

        Put(fields, "items", items);
        return fields;
    }

    private static JsonObject AboutServiceCards(IElement section, string fromPage)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector("header p")?.TextContent);
        var head = section.QuerySelector(".pp-head");
        if (head is not null)
            Put(fields, "diagramLabel", DiagramTitle(head));
        var items = new JsonArray();
        foreach (var node in section.QuerySelectorAll(".pp-track a"))
        {
            var item = new JsonObject { ["title"] = Text(node.QuerySelector(".pp-node__label") ?? node) };
            var reference = ReferenceOf(node, fromPage);
            if (reference is not null)
                item["reference"] = reference;
            items.Add(item);
        }

        Put(fields, "items", items);
        return fields;
    }

    private static JsonObject FeatureGrid(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".eswd-head p, header p")?.TextContent);
        var items = new JsonArray();
        var scenes = section.QuerySelectorAll(".eswd-scene img").ToList();
        var index = 0;
        foreach (var button in section.QuerySelectorAll(".eswd-menu__item"))
        {
            var item = new JsonObject { ["title"] = Text(button.QuerySelector(".eswd-menu__title")) };
            Put(item, "index", button.QuerySelector(".eswd-menu__num")?.TextContent);
            Put(item, "text", button.QuerySelector(".eswd-menu__desc")?.TextContent);
            Put(item, "points", Strings(button.QuerySelectorAll("li").Select(point => point.TextContent)));
            if (index < scenes.Count)
            {
                var image = MediaOf(scenes[index], fromPage, media, warnings);
                if (image is not null)
                    item["image"] = image;
            }

            items.Add(item);
            index++;
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject DeliveryFlow(IElement section)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".delivery-head p, .lead")?.TextContent);
        Put(fields, "inputs", Strings(section.QuerySelectorAll(".delivery-pills-left .delivery-pill").Select(pill => pill.TextContent)));
        Put(fields, "hub", Strings(section.QuerySelectorAll(".delivery-node__label").Select(label => label.TextContent)));
        Put(fields, "outputs", Strings(section.QuerySelectorAll(".delivery-pills-right .delivery-pill").Select(pill => pill.TextContent)));
        return fields;
    }

    private static JsonObject LogoBar(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject();
        Put(fields, "label", Eyebrow(section));
        var logos = new JsonArray();
        var track = section.QuerySelector(".trust-track") ?? section;
        foreach (var image in track.QuerySelectorAll("img"))
        {
            var mediaItem = MediaOf(image, fromPage, media, warnings);
            if (mediaItem is not null)
                logos.Add(mediaItem);
        }

        fields["logos"] = logos;
        return fields;
    }

    private static JsonObject Stats(IElement section)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".numbers-head p, header p, .lead")?.TextContent);
        var items = new JsonArray();
        foreach (var stat in section.QuerySelectorAll(".stat"))
        {
            var number = stat.QuerySelector("[data-count]");
            var value = number is null
                ? Text(stat.QuerySelector(".stat-num"))
                : (number.GetAttribute("data-count") ?? "") + (number.GetAttribute("data-suffix") ?? "");
            items.Add(new JsonObject
            {
                ["value"] = value,
                ["label"] = Text(stat.QuerySelector(".stat-label")),
            });
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject PartnerGrid(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", Intro(section));
        var viewAll = ViewAll(section, fromPage);
        if (viewAll is not null)
            fields["action"] = viewAll;
        var items = new JsonArray();
        var cards = section.QuerySelectorAll(".partner-card-hub");
        if (cards.Length > 0)
        {
            foreach (var card in cards)
                items.Add(PartnerHubCard(card, fromPage, media, warnings));
        }
        else
        {
            foreach (var card in section.QuerySelectorAll("article.partner"))
            {
                var item = new JsonObject();
                var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
                if (image is not null)
                    item["image"] = image;
                Put(item, "text", card.QuerySelector(".partner-reveal p")?.TextContent);
                var anchor = card.QuerySelector("a[href]");
                var action = LinkOf(anchor, fromPage);
                if (action is not null)
                    item["action"] = action;
                var reference = ReferenceOf(anchor, fromPage);
                if (reference is not null)
                    item["reference"] = reference;
                items.Add(item);
            }
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject PartnerHubCard(IElement card, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var item = new JsonObject();
        var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
        if (image is not null)
            item["image"] = image;
        Put(item, "title", card.QuerySelector("h3")?.TextContent);
        Put(item, "text", card.QuerySelector("p")?.TextContent);
        var label = Text(card.QuerySelector(".partner-card-hub__link"));
        if (label.Length > 0)
            item["action"] = new JsonObject { ["label"] = label, ["href"] = Href(card, fromPage) };
        var reference = ReferenceOf(card, fromPage);
        if (reference is not null)
            item["reference"] = reference;
        return item;
    }

    private static JsonObject CaseCards(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", Intro(section));
        var viewAll = ViewAll(section, fromPage);
        if (viewAll is not null)
            fields["action"] = viewAll;
        Put(fields, "filters", Strings(section.QuerySelectorAll(".hub-filter").Select(button => button.TextContent)));
        var items = new JsonArray();
        foreach (var card in section.QuerySelectorAll("article.case"))
        {
            var anchor = card.QuerySelector("a[href]");
            var item = new JsonObject { ["title"] = Text(card.QuerySelector("h3")) };
            Put(item, "text", card.QuerySelector("p")?.TextContent);
            var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                item["image"] = image;
            var actionLabel = Text(card.QuerySelector(".case-btn"));
            if (actionLabel.Length > 0)
                item["action"] = new JsonObject { ["label"] = actionLabel, ["href"] = Href(anchor, fromPage) };
            var reference = ReferenceOf(anchor, fromPage);
            if (reference is not null)
                item["reference"] = reference;
            items.Add(item);
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject NewsCarousel(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", Intro(section));
        var viewAll = ViewAll(section, fromPage);
        if (viewAll is not null)
            fields["action"] = viewAll;
        var items = new JsonArray();
        foreach (var slide in section.QuerySelectorAll("article.news-slide"))
        {
            var item = new JsonObject { ["title"] = Text(slide.QuerySelector("h3")) };
            Put(item, "category", slide.QuerySelector(".news-slide__chip")?.TextContent);
            Put(item, "place", slide.QuerySelector(".news-slide__meta")?.TextContent);
            Put(item, "text", slide.QuerySelector(".news-slide__sub")?.TextContent);
            Put(item, "details", slide.QuerySelector(".news-slide__panel p")?.TextContent);
            Put(item, "detailsLabel", slide.QuerySelector(".news-slide__details")?.TextContent);
            Put(item, "year", slide.QuerySelector(".news-slide__stat-val")?.TextContent);
            Put(item, "month", slide.QuerySelector(".news-slide__stat-label")?.TextContent);
            var image = MediaOf(slide.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                item["image"] = image;
            items.Add(item);
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject BlogList(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".blogs-lead")?.TextContent ?? Intro(section));
        var viewAll = ViewAll(section, fromPage);
        if (viewAll is not null)
            fields["action"] = viewAll;
        Put(fields, "filters", Strings(section.QuerySelectorAll(".hub-filter").Select(button => button.TextContent)));
        var items = new JsonArray();
        var cards = section.QuerySelectorAll("a.blog-card");
        if (cards.Length == 0)
            cards = section.QuerySelectorAll("a.blog-dest");
        foreach (var card in cards)
        {
            var item = new JsonObject { ["title"] = Text(card.QuerySelector("h3")) };
            Put(item, "category", card.QuerySelector(".blog-card__tag")?.TextContent);
            Put(item, "readTime", card.QuerySelector(".blog-dest__meta, .blog-card__meta")?.TextContent);
            var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                item["image"] = image;
            var reference = ReferenceOf(card, fromPage);
            if (reference is not null)
                item["reference"] = reference;
            items.Add(item);
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject VacancyList(IElement section, List<string> notes)
    {
        _ = notes;
        var fields = new JsonObject
        {
            ["heading"] = Heading(section),
            ["lead"] = Text(section.QuerySelector("p")),
            ["actionLabel"] = Text(section.QuerySelector("article.careers-job-card a")),
            ["emptyMessage"] = "No open roles right now.",
        };
        return fields;
    }

    private static JsonObject Values(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject();
        var crumb = new JsonArray();
        foreach (var part in section.QuerySelectorAll(".careers-crumb a, .careers-crumb__current"))
        {
            var text = Text(part);
            if (text.Length > 0)
                crumb.Add(text);
        }

        Put(fields, "breadcrumb", crumb);
        Put(fields, "badge", Strings(section.QuerySelectorAll(".careers-values__badge span").Select(part => part.TextContent)));
        var photos = new JsonArray();
        foreach (var image in section.QuerySelectorAll(".careers-values__photo img"))
        {
            var mediaItem = MediaOf(image, fromPage, media, warnings);
            if (mediaItem is not null)
                photos.Add(mediaItem);
        }

        Put(fields, "photos", photos);
        fields["items"] = Pairs(section, "article.careers-values__card");
        return fields;
    }

    private static JsonObject CallToAction(IElement section, string fromPage)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "text", section.QuerySelector("p")?.TextContent);
        var action = LinkOf(section.QuerySelector("a[href]"), fromPage);
        if (action is not null)
            fields["action"] = action;
        return fields;
    }

    private static JsonObject ContactDetails(IElement section, string fromPage, List<string> notes)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".contact-left .lead, .lead")?.TextContent);
        var channels = new JsonArray();
        foreach (var anchor in section.QuerySelectorAll(".contact-list a"))
        {
            channels.Add(new JsonObject
            {
                ["label"] = Text(anchor),
                ["href"] = Href(anchor, fromPage),
            });
        }

        Put(fields, "channels", channels);
        var form = section.QuerySelector("form");
        var fieldsForm = new JsonObject();
        if (form is not null)
        {
            Put(fieldsForm, "situationLabel", form.QuerySelector("label[for='situation'], .field-label")?.TextContent);
            var situations = new JsonArray();
            foreach (var option in form.QuerySelectorAll("select option"))
            {
                var value = option.GetAttribute("value") ?? "";
                if (value.Length == 0)
                {
                    Put(fieldsForm, "situationPlaceholder", option.TextContent);
                    continue;
                }

                situations.Add(new JsonObject { ["value"] = value, ["label"] = Text(option) });
            }

            Put(fieldsForm, "situations", situations);
            Put(fieldsForm, "namePlaceholder", form.QuerySelector("input[name='name']")?.GetAttribute("placeholder"));
            Put(fieldsForm, "organizationPlaceholder", form.QuerySelector("input[name='org']")?.GetAttribute("placeholder"));
            Put(fieldsForm, "rolePlaceholder", form.QuerySelector("input[name='role']")?.GetAttribute("placeholder"));
            Put(fieldsForm, "emailPlaceholder", form.QuerySelector("input[name='email']")?.GetAttribute("placeholder"));
            Put(fieldsForm, "messagePlaceholder", form.QuerySelector("textarea")?.GetAttribute("placeholder"));
            Put(fieldsForm, "buttonText", form.QuerySelector("#submitText")?.TextContent);
        }

        var script = PageScript(section);
        if (script is not null)
        {
            var buttonTexts = new JsonArray();
            var block = Regex.Match(script, @"ctaMap\s*=\s*\{([^}]*)\}");
            if (block.Success)
            {
                foreach (Match entry in Regex.Matches(block.Groups[1].Value, @"(\w+)\s*:\s*'((?:\\'|[^'])*)'"))
                {
                    buttonTexts.Add(new JsonObject
                    {
                        ["value"] = entry.Groups[1].Value,
                        ["label"] = entry.Groups[2].Value.Replace("\\'", "'", StringComparison.Ordinal),
                    });
                }
            }

            Put(fieldsForm, "buttonTexts", buttonTexts);
            Put(fieldsForm, "sendingText", ScriptString(script, @"textContent = '(Sending[^']*)'"));
            Put(fieldsForm, "successMessage", ScriptString(script, @"textContent = '(Thank you(?:\\'|[^'])*)'"));
            Put(fieldsForm, "errorMessage", ScriptString(script, @"\|\| '((?:\\'|[^'])*)'"));
        }

        if (fieldsForm["successMessage"] is null)
            fieldsForm["successMessage"] = "";
        if (fieldsForm["buttonText"] is null)
            fieldsForm["buttonText"] = "";
        if (fieldsForm["situationLabel"] is null)
            fieldsForm["situationLabel"] = "";
        fields["form"] = fieldsForm;
        notes.Add("Form labels, placeholders, and the default button are in the section. Situation-specific button text, the sending text, the success message, and the error message come from the page script. The form controls stay in code. The honeypot is not a field.");
        return fields;
    }

    private static JsonObject Timeline(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".about-history__head p, header p")?.TextContent);
        var images = section.QuerySelectorAll(".jtl-slide img").ToList();
        var items = new JsonArray();
        var index = 0;
        foreach (var item in section.QuerySelectorAll(".jtl-item"))
        {
            var row = new JsonObject
            {
                ["year"] = Text(item.QuerySelector(".jtl-year")),
                ["text"] = Text(item.QuerySelector(".jtl-text")),
            };
            if (index < images.Count)
            {
                var image = MediaOf(images[index], fromPage, media, warnings);
                if (image is not null)
                    row["image"] = image;
            }

            items.Add(row);
            index++;
        }

        fields["items"] = items;
        return fields;
    }

    private static JsonObject Profile(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = new JsonObject
        {
            ["name"] = Text(section.QuerySelector(".about-ceo__photo-meta strong")),
            ["quote"] = Text(section.QuerySelector("blockquote p")),
        };
        Put(fields, "role", section.QuerySelector(".about-ceo__photo-meta span")?.TextContent);
        Put(fields, "cite", section.QuerySelector("cite")?.TextContent);
        var image = MediaOf(section.QuerySelector("img"), fromPage, media, warnings);
        if (image is not null)
            fields["image"] = image;
        return fields;
    }

    private static JsonObject TeamGrid(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector("header p")?.TextContent);
        var members = new JsonArray();
        foreach (var card in section.QuerySelectorAll(".team-card"))
        {
            var member = new JsonObject
            {
                ["name"] = Text(card.QuerySelector("h3")),
                ["role"] = Text(card.QuerySelector(".team-card__role")),
            };
            var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                member["image"] = image;
            members.Add(member);
        }

        fields["members"] = members;
        return fields;
    }

    private static JsonObject Problem(IElement section)
    {
        if (section.QuerySelector(".problem-pipeline, .pp-card") is null)
            return Prose(section);

        var fields = Headed(section);
        Put(fields, "lead", section.QuerySelector(".problem-lead p")?.TextContent);
        var head = section.QuerySelector(".pp-head");
        if (head is not null)
        {
            Put(fields, "diagramStatus", head.QuerySelector(".pp-head__status")?.TextContent);
            Put(fields, "diagramTitle", DiagramTitle(head));
        }

        Put(fields, "flow", Strings(section.QuerySelectorAll(".pp-node__label").Select(label => label.TextContent)));
        var cards = new JsonArray();
        foreach (var card in section.QuerySelectorAll(".pp-card"))
        {
            cards.Add(new JsonObject
            {
                ["title"] = Text(card.QuerySelector("h3")),
                ["text"] = Text(card.QuerySelector("p")),
            });
        }

        Put(fields, "cards", cards);
        var outcomes = new JsonArray();
        foreach (var outcome in section.QuerySelectorAll(".problem-outcome"))
        {
            outcomes.Add(new JsonObject
            {
                ["title"] = Text(outcome.QuerySelector("strong")),
                ["text"] = Text(outcome.QuerySelector("p")),
            });
        }

        Put(fields, "outcomes", outcomes);
        Put(fields, "quote", section.QuerySelector(".problem-quote p")?.TextContent);
        Put(fields, "cite", section.QuerySelector(".problem-quote cite")?.TextContent);
        return fields;
    }

    private static JsonObject Methodology(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var fields = Headed(section);
        Put(fields, "lead", Intro(section));
        var steps = new JsonArray();
        foreach (var row in section.QuerySelectorAll("article.method-row"))
        {
            var step = new JsonObject
            {
                ["title"] = Text(row.QuerySelector("h3")),
                ["text"] = Text(row.QuerySelector("p")),
            };
            Put(step, "index", row.QuerySelector(".method-step-num")?.TextContent);
            var image = MediaOf(row.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                step["image"] = image;
            steps.Add(step);
        }

        fields["steps"] = steps;
        return fields;
    }

    private static JsonObject PartnerOverview(IElement section, string fromPage)
    {
        var fields = new JsonObject();
        Put(fields, "eyebrow", Eyebrow(section));
        Put(fields, "index", section.QuerySelector(".partner-overview__index")?.TextContent);
        Put(fields, "lede", section.QuerySelector(".partner-overview__lede")?.TextContent);
        Put(fields, "paragraphs", Strings(section.QuerySelectorAll(".partner-overview__body").Select(paragraph => paragraph.TextContent)));
        Put(fields, "deliverablesLabel", section.QuerySelector(".partner-overview__capabilities-label")?.TextContent);
        Put(fields, "deliverablesHeading", section.QuerySelector(".partner-overview__subtitle")?.TextContent);
        Put(fields, "chips", Strings(section.QuerySelectorAll(".partner-overview__chips li").Select(chip => chip.TextContent)));
        var action = LinkOf(section.QuerySelector(".partner-overview__cta"), fromPage);
        if (action is not null)
            fields["action"] = action;
        return fields;
    }

    private static JsonObject RelatedItems(IElement section, string fromPage, Dictionary<string, MediaAsset> media, ImportModel model, List<string> warnings, List<string> notes)
    {
        var fields = Headed(section);
        var items = new JsonArray();
        var matched = 0;
        var blankSource = 0;
        var cards = section.QuerySelectorAll(".cs-related a, a.partner-card-hub");
        if (cards.Length == 0)
            cards = section.QuerySelectorAll("a[href]");
        foreach (var card in cards)
        {
            var reference = ReferenceOf(card, fromPage);
            if (reference is null)
                continue;
            var linkedReference = Links.Reference(Links.Rewrite(card.GetAttribute("href"), fromPage).Clean);
            if (linkedReference is null)
                continue;
            var type = linkedReference.Value.Type;
            var slug = linkedReference.Value.Slug;
            var linked = Linked(model, type, slug);
            var shownTitle = Text(card.QuerySelector(".cs-related__title, h3") ?? card);
            var shownText = Text(card.QuerySelector(".partner-card-hub__desc, p"));
            var title = Override(shownTitle, linked.Title, ref matched, ref blankSource);
            var text = Override(shownText, linked.Summary, ref matched, ref blankSource);
            var item = new JsonObject
            {
                ["type"] = type,
                ["id"] = reference["id"]!.GetValue<string>(),
                ["title"] = title,
                ["text"] = text,
            };
            Put(item, "label", card.QuerySelector(".cs-related__label")?.TextContent);
            var action = Text(card.QuerySelector(".partner-card-hub__link"));
            if (action.Length > 0)
                item["action"] = action;
            var image = MediaOf(card.QuerySelector("img"), fromPage, media, warnings);
            if (image is not null)
                item["image"] = image;
            items.Add(item);
        }

        fields["items"] = items;
        if (matched > 0)
            notes.Add(matched + " title or text overrides stored empty because they match the linked item.");
        if (blankSource > 0)
            notes.Add(blankSource + " title or text values were empty on the card and are stored empty, so the card will render the linked item.");
        return fields;
    }

    private static JsonObject TitledPairs(IElement section, string selector)
    {
        var fields = Headed(section);
        Put(fields, "lead", Intro(section));
        fields["items"] = Pairs(section, selector);
        return fields;
    }

    private static JsonObject Prose(IElement section)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", Eyebrow(section));
        var root = section.QuerySelector(".cs-section") ?? section.QuerySelector(".section-inner") ?? section;
        var blocks = Blocks(root);
        if (blocks.Count > 0)
            fields["blocks"] = blocks;
        return fields;
    }

    private static JsonArray Pairs(IElement section, string selector)
    {
        var items = new JsonArray();
        foreach (var card in section.QuerySelectorAll(selector))
        {
            items.Add(new JsonObject
            {
                ["title"] = Text(card.QuerySelector("h3")),
                ["text"] = Text(card.QuerySelector("p")),
            });
        }

        return items;
    }

    private static JsonObject Headed(IElement section)
    {
        var fields = new JsonObject { ["heading"] = Heading(section) };
        Put(fields, "eyebrow", Eyebrow(section));
        return fields;
    }

    private static string Heading(IElement section) => Text(section.QuerySelector("h1, h2"));

    private static string? Eyebrow(IElement section) =>
        Collapse(section.QuerySelector(".label, .svc-eyebrow, .about-eyebrow")?.TextContent);

    private static string? Intro(IElement section) =>
        Collapse(section.QuerySelector(".hub-head p, .partners-head p, .section-head p, .numbers-head p, .eswd-head p, .delivery-head p, header p")?.TextContent);

    private static JsonObject? ViewAll(IElement section, string fromPage)
    {
        var anchor = section.QuerySelectorAll("a[href]").FirstOrDefault(candidate =>
            Text(candidate).StartsWith("View all", StringComparison.OrdinalIgnoreCase));
        return LinkOf(anchor, fromPage);
    }

    private static string DiagramTitle(IElement head)
    {
        var status = Text(head.QuerySelector(".pp-head__status"));
        var title = Text(head);
        if (status.Length > 0)
            title = title.Replace(status, "", StringComparison.Ordinal);
        return Collapse(title) ?? "";
    }

    private static JsonArray Blocks(IElement root)
    {
        var blocks = new JsonArray();
        foreach (var child in root.Children)
        {
            if (child.LocalName == "p")
            {
                var text = Text(child);
                if (text.Length > 0)
                    blocks.Add(new JsonObject { ["kind"] = "paragraph", ["text"] = text });
            }
            else if (child.LocalName is "ul" or "ol")
            {
                var items = Strings(child.QuerySelectorAll("li").Select(item => item.TextContent));
                if (items.Count > 0)
                    blocks.Add(new JsonObject { ["kind"] = "list", ["items"] = items });
            }
        }

        return blocks;
    }

    private static JsonObject? LinkOf(IElement? anchor, string fromPage)
    {
        if (anchor is null)
            return null;
        var label = Text(anchor);
        if (label.Length == 0)
            return null;
        return new JsonObject { ["label"] = label, ["href"] = Href(anchor, fromPage) };
    }

    private static string Href(IElement? anchor, string fromPage)
    {
        if (anchor is null)
            return "";
        var rewritten = Links.Rewrite(anchor.GetAttribute("href"), fromPage);
        return rewritten.Clean ?? rewritten.Unresolved ?? "";
    }

    private static JsonObject? ReferenceOf(IElement? anchor, string fromPage)
    {
        if (anchor is null)
            return null;
        var reference = Links.Reference(Links.Rewrite(anchor.GetAttribute("href"), fromPage).Clean);
        if (reference is null)
            return null;
        return new JsonObject
        {
            ["type"] = reference.Value.Type,
            ["id"] = ReferenceId(reference.Value.Type, reference.Value.Slug).ToString("D"),
        };
    }

    private static JsonObject? MediaOf(IElement? image, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        if (image is null)
            return null;
        var path = Catalog.NormalizeAsset(image.GetAttribute("src") ?? "", fromPage, _sourceRoot);
        if (path is null || !media.TryGetValue(path, out var asset))
        {
            if (path is not null)
                warnings.Add("No media row for " + path);
            return null;
        }

        var alt = (image.GetAttribute("alt") ?? "").Trim();
        if (alt.Length > 300)
            alt = alt[..300];
        return new JsonObject
        {
            ["mediaId"] = asset.Id.ToString("D"),
            ["alt"] = alt,
            ["decorative"] = alt.Length == 0,
        };
    }

    private static (string Title, string Summary) Linked(ImportModel model, string type, string slug)
    {
        switch (type)
        {
            case "service":
                var service = model.Services.FirstOrDefault(item => item.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
                return service is null ? ("", "") : (service.Title, service.Summary);
            case "partner":
                var partner = model.Partners.FirstOrDefault(item => item.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
                return partner is null ? ("", "") : (partner.Title, partner.Summary);
            case "case_study":
                var study = model.Cases.FirstOrDefault(item => item.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
                return study is null ? ("", "") : (study.Title, study.Summary);
            case "blog_post":
                var blog = model.Blogs.FirstOrDefault(item => item.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
                return blog is null ? ("", "") : (blog.Title, blog.Summary);
            default:
                return ("", "");
        }
    }

    private static string Override(string shown, string linked, ref int matched, ref int blankSource)
    {
        var left = Collapse(shown) ?? "";
        var right = Collapse(linked) ?? "";
        if (left.Length > 0 && string.Equals(left, right, StringComparison.Ordinal))
        {
            matched++;
            return "";
        }

        if (left.Length == 0 && right.Length > 0)
            blankSource++;
        return left;
    }

    private static string? PageScript(IElement section)
    {
        if (section.Owner is not IDocument document)
            return null;
        foreach (var script in document.QuerySelectorAll("script"))
        {
            if (script.TextContent.Contains("ctaMap", StringComparison.Ordinal))
                return script.TextContent;
        }

        return null;
    }

    private static string? ScriptString(string script, string pattern)
    {
        var match = Regex.Match(script, pattern);
        return match.Success ? match.Groups[1].Value.Replace("\\'", "'", StringComparison.Ordinal) : null;
    }

    private static void Put(JsonObject obj, string name, string? value)
    {
        var text = Collapse(value);
        if (text is not null)
            obj[name] = text;
    }

    private static void Put(JsonObject obj, string name, JsonArray array)
    {
        if (array.Count > 0)
            obj[name] = array;
    }

    private static JsonArray Strings(IEnumerable<string?> values)
    {
        var array = new JsonArray();
        foreach (var value in values)
        {
            var text = Collapse(value);
            if (text is not null)
                array.Add(text);
        }

        return array;
    }

    private static string Text(IElement? element) => Collapse(element?.TextContent) ?? "";

    private static List<string> VisibleFragments(IElement? root)
    {
        var parts = new List<string>();
        if (root is not null)
            CollectVisible(root, parts);
        return parts;
    }

    internal static void CollectVisible(INode node, List<string> parts)
    {
        if (node is IElement element)
        {
            if (element.LocalName is "script" or "style" or "svg" or "noscript")
                return;
            if (element.ClassList.Contains("svc-hero-stage") || element.ClassList.Contains("contact-honeypot"))
                return;
            if (element.HasAttribute("data-count"))
            {
                AddVisible(parts, (element.GetAttribute("data-count") ?? "") + (element.GetAttribute("data-suffix") ?? ""));
                return;
            }

            if (element.LocalName == "img")
            {
                AddVisible(parts, element.GetAttribute("alt"));
                return;
            }

            var placeholder = element.GetAttribute("placeholder");
            if (!string.IsNullOrWhiteSpace(placeholder))
                AddVisible(parts, placeholder);
            foreach (var child in element.ChildNodes)
                CollectVisible(child, parts);
            return;
        }

        if (node is IText text)
            AddVisible(parts, text.Data);
    }

    private static void AddVisible(List<string> parts, string? value)
    {
        var collapsed = Collapse(value);
        if (collapsed is null || !collapsed.Any(char.IsLetterOrDigit))
            return;
        parts.Add(collapsed);
    }
}

sealed class SectionProbe
{
    public string Owner { get; set; } = "";

    public string Type { get; set; } = "";

    public string Source { get; set; } = "";

    public required IElement Element { get; init; }

    public required JsonObject Fields { get; init; }

    public List<string> Notes { get; set; } = [];
}
