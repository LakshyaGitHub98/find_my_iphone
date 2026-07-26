"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type TwoFactorMethod } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [appleId, setAppleId] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [methods, setMethods] = useState<TwoFactorMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.login(appleId, password);
      if (res.status === "ok") {
        router.push("/dashboard");
      } else if (res.status === "needs_2fa" && res.token && res.methods) {
        setToken(res.token);
        setMethods(res.methods);
        setSelectedMethod(res.methods[0]?.id || "");
        setStep("2fa");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    setError("");
    setLoading(true);
    try {
      await api.auth.send2FA(token, selectedMethod);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const hasMethods = methods.length > 0;
      if (hasMethods) {
        const isPhone = methods.find((m) => m.id === selectedMethod)?.type === "phone";
        if (isPhone) {
          await api.auth.verify2FA(token, selectedMethod, code);
        } else {
          await api.auth.verify2FA(token, selectedMethod, code);
        }
      } else {
        await api.auth.verify2FADirect(token, code);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  if (step === "2fa") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the verification code sent to your Apple device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              {methods.length > 0 && (
                <div className="space-y-2">
                  <Label>Verification method</Label>
                  <div className="grid gap-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMethod(m.id);
                          setCode("");
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          selectedMethod === m.id
                            ? "border-primary bg-primary/5"
                            : "border-input hover:bg-accent"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {methods.find((m) => m.id === selectedMethod)?.type === "phone" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendCode}
                      disabled={loading}
                      className="w-full"
                    >
                      Send SMS code
                    </Button>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Find My</CardTitle>
          <CardDescription>Sign in to your iCloud account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appleId">Apple ID</Label>
              <Input
                id="appleId"
                type="email"
                placeholder="me@icloud.com"
                value={appleId}
                onChange={(e) => setAppleId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
