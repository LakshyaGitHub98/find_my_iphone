"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LostModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { number: string; message: string; passcode: string }) => Promise<void>;
  deviceName: string;
}

export default function LostModeDialog({
  open,
  onOpenChange,
  onSubmit,
  deviceName,
}: LostModeDialogProps) {
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState(
    "This iPhone has been lost. Please call me.",
  );
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ number, message, passcode });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to enable Lost Mode");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lost Mode</DialogTitle>
          <DialogDescription>
            Enable Lost Mode on {deviceName}. The device will be locked and a
            message will be displayed on the screen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="number">Phone number to call</Label>
            <Input
              id="number"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Lock screen message</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passcode">New passcode (4 digits, optional)</Label>
            <Input
              id="passcode"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="1234"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enabling..." : "Enable Lost Mode"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
