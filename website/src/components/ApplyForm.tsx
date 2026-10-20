export function ApplyForm({ vacancyId, email }: { vacancyId?: string; email: string }) {
  const address = email.trim();
  return (
    <section className="careers-apply" id="apply" data-reveal="">
      <style>{`
        .apply-form { display: flex; flex-direction: column; gap: 0.85rem; max-width: 36rem; }
        .apply-form label { display: flex; flex-direction: column; gap: 0.3rem; }
        .apply-form input, .apply-form textarea { font: inherit; color: inherit; padding: 0.65rem 0.8rem; border: 1px solid #d5dbe3; border-radius: 0.6rem; background: #fff; }
        .apply-form input[type="file"] { padding: 0.45rem; }
        .apply-consent { flex-direction: row; align-items: flex-start; gap: 0.5rem; }
        .apply-honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
      `}</style>
      <h2>Apply</h2>
      <form className="apply-form" method="post" action="/api/v1/public/apply" encType="multipart/form-data">
        {vacancyId ? <input type="hidden" name="vacancyId" value={vacancyId} /> : null}
        <label>Name<input name="name" required maxLength={200} autoComplete="name" /></label>
        <label>Email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
        <label>Phone <span>(optional)</span><input name="phone" maxLength={40} autoComplete="tel" /></label>
        <label>Message <span>(optional)</span><textarea name="message" maxLength={1000} rows={4} /></label>
        <label>CV <span>(PDF or Word, up to 5 MB)</span><input name="cv" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label>
        <label className="apply-consent"><input name="consent" type="checkbox" value="yes" required /> I have read the <a href="/privacy-careers">privacy notice</a> and agree to this use.</label>
        <label className="apply-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <button className="btn-pill" type="submit">Send application</button>
        {address ? <p>If this form cannot be sent, email us at <a href={`mailto:${address}`}>{address}</a>.</p> : null}
      </form>
    </section>
  );
}
