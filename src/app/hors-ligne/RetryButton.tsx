"use client";

import { Button } from "@/components/ui/Button";

export function RetryButton({ label }: { label: string }) {
  return <Button onClick={() => window.location.reload()}>{label}</Button>;
}
