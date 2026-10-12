import { Alert, Button, Form, Input, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request } from "../api/http";
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

export function SettingsPage() {
  const auth = useAuth();
  const canEdit = auth.user?.role === "admin";
  const [form] = Form.useForm<Settings>();
  const [error, setError] = useState<string | null>(null);

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
  }

  async function save(values: Settings) {
    const result = await request("/api/v1/settings", jsonInit("PUT", values));
    if (!result.ok) {
      setError(result.problem?.title ?? "Settings were not saved.");
      return;
    }
    setError(null);
    form.setFieldsValue(result.body as Settings);
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
    </section>
  );
}
