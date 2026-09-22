import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { brand } from "../theme";
import { useAuth } from "./AuthProvider";

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
    <main className="grid min-h-svh place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md" variant="outlined">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-8 w-8 rounded-md"
            style={{ backgroundColor: brand.accent }}
          />
          <div>
            <Typography.Title level={3} className="!mb-0">
              Content Studio
            </Typography.Title>
            <Typography.Text type="secondary">Digital Hub</Typography.Text>
          </div>
        </div>
        {error !== null ? <Alert className="!mb-4" type="error" showIcon message={error} /> : null}
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
      </Card>
    </main>
  );
}
