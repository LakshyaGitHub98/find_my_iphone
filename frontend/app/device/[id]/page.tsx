"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, type DeviceDetail, type DeviceLocation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import LostModeDialog from "@/components/LostModeDialog";
import {
  ArrowLeft,
  Bell,
  ShieldAlert,
  MapPin,
  Battery,
  Clock,
  Crosshair,
  Smartphone,
} from "lucide-react";

const DeviceMap = dynamic(() => import("@/components/DeviceMap"), { ssr: false });

function formatTimestamp(ts: number): string {
  const d = new Date(ts / 1000);
  return d.toLocaleString();
}

export default function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    Promise.all([
      api.devices.get(deviceId),
      api.devices.location(deviceId).catch(() => null),
    ])
      .then(([dev, loc]) => {
        setDevice(dev);
        setLocation(loc);
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [deviceId, router]);

  async function handlePlaySound() {
    setActionLoading("sound");
    try {
      await api.devices.playSound(deviceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to play sound");
    } finally {
      setActionLoading("");
    }
  }

  async function handleLostMode(data: { number: string; message: string; passcode: string }) {
    setActionLoading("lost");
    try {
      await api.devices.lostMode(deviceId, data.number, data.message, data.passcode);
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-64 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6">
        <p className="text-destructive">Device not found</p>
        <Button onClick={() => router.push("/dashboard")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to devices
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <Badge variant={device.isOnline ? "success" : "secondary"}>
              {device.isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{device.model}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePlaySound}
            disabled={actionLoading === "sound"}
          >
            <Bell className="mr-1 h-4 w-4" />
            {actionLoading === "sound" ? "Sending..." : "Play Sound"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setLostOpen(true)}
            disabled={actionLoading === "lost"}
          >
            <ShieldAlert className="mr-1 h-4 w-4" />
            Lost Mode
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {location ? (
        <Card className="mb-6 overflow-hidden">
          <div className="h-[300px] sm:h-[400px]">
            <DeviceMap
              latitude={location.latitude}
              longitude={location.longitude}
              accuracy={location.horizontalAccuracy}
              name={device.name}
            />
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="mb-2 h-8 w-8" />
            <p>No location data available for this device.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {location && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" /> Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Latitude:</span>{" "}
                {location.latitude.toFixed(6)}
              </p>
              <p>
                <span className="text-muted-foreground">Longitude:</span>{" "}
                {location.longitude.toFixed(6)}
              </p>
              {location.horizontalAccuracy && (
                <p>
                  <span className="text-muted-foreground">Accuracy:</span>{" "}
                  ±{location.horizontalAccuracy}m
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Type:</span>{" "}
                {location.positionType || "N/A"}
              </p>
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(location.timestamp)}
              </p>
              {location.isOld && (
                <Badge variant="warning" className="mt-1">Stale location</Badge>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Battery className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {device.batteryPercent && (
              <p>
                <span className="text-muted-foreground">Battery:</span>{" "}
                {device.batteryPercent}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              {device.isOnline ? "Online" : `Offline (${device.deviceStatus})`}
            </p>
            {device.activationLocked && (
              <p className="flex items-center gap-1 text-destructive">
                <ShieldAlert className="h-3 w-3" /> Activation Locked
              </p>
            )}
            {device.isLocating && (
              <p className="flex items-center gap-1">
                <Crosshair className="h-3 w-3" /> Currently locating
              </p>
            )}
          </CardContent>
        </Card>

        {device.status && Object.keys(device.status).length > 0 && (
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4" /> Device Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {Object.entries(device.status).map(([key, val]) => (
                  <p key={key}>
                    <span className="text-muted-foreground">{key}:</span>{" "}
                    {typeof val === "number" && key === "batteryLevel"
                      ? `${(val * 100).toFixed(0)}%`
                      : String(val)}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <LostModeDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onSubmit={handleLostMode}
        deviceName={device.name}
      />
    </div>
  );
}
