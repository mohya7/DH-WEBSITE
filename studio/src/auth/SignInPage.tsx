import { Button, Form, Input, Typography } from "antd";
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
    return <Navigate to="/pages" replace />;
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
      <div className="surface-card sign-in-card">
        <div className="mb-6">
          <img className="sign-in-logo mb-4" src={logo} alt="Digital Hub" />
          <Typography.Title level={3} className="!mb-1">
            Content Studio
          </Typography.Title>
          <Typography.Text type="secondary">Sign in to edit the website.</Typography.Text>
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
            Sign in
          </Button>
        </Form>
      </div>
    </main>
  );
}
