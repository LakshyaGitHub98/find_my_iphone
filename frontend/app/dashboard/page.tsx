"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Device } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Smartphone, Battery, MapPin, Bell, ShieldAlert } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.devices
      .list()
      .then(setDevices)
      .catch(() => {
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await api.auth.logout();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Find My</h1>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => router.push("/login")}>Back to login</Button>
      </div>
    );
  }

  const iconMap: Record<string, React.ReactNode> = {
    iPhone: <Smartphone className="h-8 w-8" />,
    iPad: <Smartphone className="h-8 w-8" />,
    Mac: <Smartphone className="h-8 w-8" />,
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Find My</h1>
          <p className="text-sm text-muted-foreground">
            {devices.length} device{devices.length !== 1 ? "s" : ""} on your account
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          Sign out
        </Button>
      </header>

      {devices.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No devices found on your account.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((d) => (
          <Card
            key={d.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push(`/device/${d.id}`)}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                {iconMap[d.deviceClass] || <Smartphone className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">{d.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{d.model}</p>
              </div>
              <Badge variant={d.isOnline ? "success" : "secondary"}>
                {d.isOnline ? "Online" : "Offline"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {d.batteryPercent && (
                  <span className="flex items-center gap-1">
                    <Battery className="h-3.5 w-3.5" />
                    {d.batteryPercent}
                  </span>
                )}
                {d.isLocating && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Locating
                  </span>
                )}
                {d.activationLocked && (
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Locked
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {devices.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Click a device to view location and actions
        </p>
      )}
    </div>
  );
}
