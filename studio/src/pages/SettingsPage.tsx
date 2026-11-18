import { Alert, Button, Form, Input, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request } from "../api/http";
import { MediaPicker, type MediaChoice } from "../content/MediaPicker";
import { PageHeader } from "../ui/PageHeader";

type Settings = {
  phone?: string | null;
  whatsApp?: string | null;
  email?: string | null;
  careersEmail?: string | null;
  linkedIn?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tikTok?: string | null;
  footerText?: string | null;
  streetAddress?: string | null;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  defaultMetaTitle?: string | null;
  defaultMetaDescription?: string | null;
  defaultShareImageId?: string | null;
  defaultShareImageAltOverride?: string | null;
  organizationName?: string | null;
  legalName?: string | null;
  analyticsContainerId?: string | null;
  cookieBannerText?: string | null;
  cookieBannerTitle?: string | null;
  cookieAcceptLabel?: string | null;
  cookieRejectLabel?: string | null;
  cookieAnalyticsLabel?: string | null;
  cookieSettingsLabel?: string | null;
};

type ShownImage = { state: "none" } | { state: "missing" } | { state: "found"; path: string; alt: string };

/*
 * ADM-10: the default share image, as a registered form field, so every Save
 * carries the id (or null once cleared). The picker that onChoose opens lives
 * outside the settings form; see SettingsPage.
 */
function ShareImageField({ value, onChange, onChoose }: { value?: string | null; onChange?: (value: string | null) => void; onChoose: () => void }) {
  const [shown, setShown] = useState<ShownImage>({ state: "none" });

  useEffect(() => {
    if (value === undefined || value === null) {
      setShown({ state: "none" });
      return;
    }

    let current = true;
    void (async () => {
      const result = await request(`/api/v1/media/${encodeURIComponent(value)}`);
      if (!current) return;
      const image = result.ok ? (result.body as { image?: { path: string; alt: string } } | null)?.image : undefined;
      setShown(image === undefined ? { state: "missing" } : { state: "found", path: image.path, alt: image.alt });
    })();
    return () => {
      current = false;
    };
  }, [value]);

  const chosen = value !== undefined && value !== null;
  return (
    <div data-field="defaultShareImage">
      {shown.state === "found" ? (
        <div className="mb-2">
          <img src={shown.path} alt={shown.alt} className="mb-1 h-20 object-contain" />
          <div className="text-sm">{shown.path}</div>
        </div>
      ) : null}
      {chosen && shown.state === "missing" ? <Typography.Paragraph type="danger">The chosen image is no longer in the library.</Typography.Paragraph> : null}
      {!chosen ? <Typography.Paragraph>No image chosen. Pages without their own share image have none.</Typography.Paragraph> : null}
      <Space>
        <Button onClick={onChoose}>{chosen ? "Change image" : "Choose image"}</Button>
        <Button onClick={() => onChange?.(null)}>Clear</Button>
      </Space>
    </div>
  );
}

export function SettingsPage() {
  const auth = useAuth();
  const canEdit = auth.user?.role === "admin";
  const [form] = Form.useForm<Settings>();
  const [error, setError] = useState<string | null>(null);
  // The version the settings were read at; a save sends it back and gets 409
  // when someone else saved in between.
  const [version, setVersion] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const result = await request("/api/v1/settings");
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Settings could not be loaded.");
      return;
    }
    form.setFieldsValue(result.body as Settings);
    setVersion((result.body as { version: number }).version);
  }

  async function save(values: Settings) {
    const result = await request("/api/v1/settings", jsonInit("PUT", { ...values, version }));
    if (!result.ok) {
      setError(result.problem?.title ?? "Settings were not saved.");
      return;
    }
    setError(null);
    form.setFieldsValue(result.body as Settings);
    setVersion((result.body as { version: number }).version);
    message.success("Settings saved.");
  }

  return (
    <section className="surface-card max-w-3xl">
      <PageHeader title="Site settings" />
      {!canEdit ? <Alert className="!mb-4" type="info" showIcon title="Editors can view settings. Only admins can save changes." /> : null}
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Form form={form} layout="vertical" disabled={!canEdit} onFinish={(values) => void save(values)}>
        <Form.Item label="Email" name="email"><Input /></Form.Item>
        <Form.Item label="Careers email" name="careersEmail" extra="Shown on the careers, apply, and vacancy pages in place of the main email."><Input /></Form.Item>
        <Form.Item label="Phone" name="phone"><Input /></Form.Item>
        <Form.Item label="WhatsApp" name="whatsApp"><Input /></Form.Item>
        <Form.Item label="LinkedIn" name="linkedIn"><Input /></Form.Item>
        <Form.Item label="Facebook" name="facebook"><Input /></Form.Item>
        <Form.Item label="Instagram" name="instagram"><Input /></Form.Item>
        <Form.Item label="TikTok" name="tikTok"><Input /></Form.Item>
        <Form.Item label="Street address" name="streetAddress"><Input /></Form.Item>
        <Form.Item label="Locality" name="locality"><Input /></Form.Item>
        <Form.Item label="Region" name="region"><Input /></Form.Item>
        <Form.Item label="Postal code" name="postalCode"><Input /></Form.Item>
        <Form.Item label="Country" name="country"><Input /></Form.Item>
        <Form.Item label="Organisation name" name="organizationName"><Input /></Form.Item>
        <Form.Item label="Legal name" name="legalName"><Input /></Form.Item>
        <Form.Item label="Default meta title" name="defaultMetaTitle"><Input /></Form.Item>
        <Form.Item label="Default meta description" name="defaultMetaDescription"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Default share image" name="defaultShareImageId"><ShareImageField onChoose={() => setPicker(true)} /></Form.Item>
        <Form.Item label="Default share image alt text" name="defaultShareImageAltOverride" extra="The alt text for the default share image, on pages that use it. Empty uses the page title."><Input maxLength={300} /></Form.Item>
        <Form.Item label="Analytics container ID" name="analyticsContainerId" extra="Google Tag Manager, GTM- followed by at least seven letters or digits. Empty means the site loads no tag, banner, or cookie."><Input placeholder="GTM-XXXXXXX" /></Form.Item>
        <Form.Item label="Cookie banner title" name="cookieBannerTitle" extra="Empty uses “Cookies on this site”."><Input /></Form.Item>
        <Form.Item label="Cookie banner text" name="cookieBannerText" extra="The banner body. Empty uses the built-in English sentence."><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Accept all label" name="cookieAcceptLabel"><Input /></Form.Item>
        <Form.Item label="Reject all label" name="cookieRejectLabel"><Input /></Form.Item>
        <Form.Item label="Analytics only label" name="cookieAnalyticsLabel"><Input /></Form.Item>
        <Form.Item label="Cookie settings label" name="cookieSettingsLabel" extra="The footer control that reopens the banner."><Input /></Form.Item>
        <Form.Item label="Footer text" name="footerText"><Input.TextArea rows={3} /></Form.Item>
        {canEdit ? <Button type="primary" htmlType="submit">Save</Button> : null}
      </Form>
      <MediaPicker open={picker} onClose={() => setPicker(false)} onSelect={(choice: MediaChoice) => { form.setFieldValue("defaultShareImageId", choice.id); setPicker(false); }} />
    </section>
  );
}
