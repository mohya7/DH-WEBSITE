import { Button, Form, Input } from "antd";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import logo from "@digitalhub/theme/assets/digital-hub-logo.png";

type SignInValues = {
  email: string;
  password: string;
};

export function SignInPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.ready && auth.user !== null) {
    return <Navigate to="/" replace />;
  }

  async function onFinish(values: SignInValues) {
    setSubmitting(true);
    setError(null);
    try {
      await auth.signIn(values.email, values.password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="sign-in">
      <div className="sign-in-brand">
        <img src={logo} alt="Digital Hub" />
      </div>
      <div className="sign-in-card">
        <aside className="sign-in-visual">
          <span className="eyebrow">SECURE ADMIN WORKSPACE</span>
          <h1>Welcome to your<br /><em>Content Studio</em></h1>
          <p>Manage every page and content card from one place, with drafts, ordering, and a separate publish step before the next build.</p>
        </aside>
        <div className="sign-in-panel">
          <div className="mb-6">
            <strong>Sign in</strong>
            <p className="mb-0" style={{ color: "var(--dh-text-secondary)", fontSize: 12 }}>Use your Content Studio email and password.</p>
          </div>
          {error !== null ? <p className="mb-4 text-sm" style={{ color: "var(--dh-error)" }}>{error}</p> : null}
          <Form<SignInValues> layout="vertical" requiredMark={false} onFinish={(values) => void onFinish(values)}>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: "email", message: "Enter a valid email." }]}
            >
              <Input autoComplete="username" inputMode="email" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, message: "Enter your password." }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Sign in to Content Studio
            </Button>
          </Form>
        </div>
      </div>
    </main>
  );
}
