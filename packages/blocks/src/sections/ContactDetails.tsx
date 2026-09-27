/*
 * contact_details: the contact page's channels and enquiry form. This renders
 * the form's markup with its texts from the section; submitting it is a plain
 * script (Section 5.4).
 */
import type { BlockContext } from "../context";
import type { ContactDetailsFields } from "../generated/schema-types";

function channelIcon(href: string): string {
  if (href.startsWith("tel:")) return "ti-phone";
  if (href.startsWith("mailto:")) return "ti-mail";
  if (/wa\.me|whatsapp/i.test(href)) return "ti-brand-whatsapp";
  return "ti-link";
}

export function ContactDetails({ fields, ctx }: { fields: ContactDetailsFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const form = fields.form;
  return (
    <section className="contact-page" id="contact">
      <div className="contact-page__inner">
        <div className="contact">
          <div className="contact-inner">
            <div className="contact-left" data-reveal="">
              {fields.eyebrow ? (
                <span className="label" style={{ color: "var(--orange)" }}>
                  {fields.eyebrow}
                </span>
              ) : null}
              <h2 className="h2">{fields.heading}</h2>
              {fields.lead ? <p className="lead">{fields.lead}</p> : null}
              {fields.channels && fields.channels.length > 0 ? (
                <div className="contact-list">
                  {fields.channels.map((channel, index) => {
                    const external = /^https?:\/\//.test(channel.href);
                    return (
                      <Link key={index} href={channel.href} attributes={external ? { target: "_blank", rel: "noopener" } : undefined}>
                        <i className={`ti ${channelIcon(channel.href)}`}></i>
                        {` ${channel.label}`}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <form className="contact-card" id="contactForm" data-reveal="" noValidate>
              <div className="contact-honeypot" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <label className="field-label" htmlFor="situation">
                  {form.situationLabel}
                </label>
                <select className="select" id="situation" name="situation" required>
                  <option value="">{form.situationPlaceholder ?? ""}</option>
                  {(form.situations ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <input className="input" type="text" name="name" placeholder={form.namePlaceholder} required />
                <input className="input" type="text" name="org" placeholder={form.organizationPlaceholder} required />
              </div>

              <div className="field-row">
                <input className="input" type="text" name="role" placeholder={form.rolePlaceholder} />
                <input className="input" type="email" name="email" placeholder={form.emailPlaceholder} required />
              </div>

              <textarea className="textarea" name="message" placeholder={form.messagePlaceholder} required></textarea>
              <p className="form-error" id="contactFormError" role="alert" hidden></p>

              <button type="submit" className="submit-btn" id="submitBtn">
                <span id="submitText">{form.buttonText}</span>
                <i className="ti ti-arrow-right"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
