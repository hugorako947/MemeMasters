"use client";

import { useEffect, useRef, useState } from "react";
import { cardArtDataUri } from "@/lib/art/generate";
import type { Rarity } from "@/config/rarities";
import type { Vibe } from "@/config/vibes";

type Mode = "auto" | "upload";

export function CardArtPicker({
  artSeed,
  vibe = "chaos",
  rarity,
  imageUrl,
}: {
  artSeed: number;
  vibe?: Vibe;
  rarity: Rarity;
  imageUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>(imageUrl ? "upload" : "auto");
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const generated = cardArtDataUri({ seed: artSeed, vibe: vibe ?? "chaos", rarity });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function setFile(file: File) {
    const input = fileRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    setPreview(URL.createObjectURL(file));
    setMode("upload");
  }

  async function startCamera() {
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("Caméra inaccessible. Autorisez-la, ou importez une photo.");
    }
  }

  function snapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setFile(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.86,
    );
  }

  return (
    <div className="grid gap-3 sm:col-span-2 lg:col-span-4">
      <input type="hidden" name="artSource" value={mode} />
      <p className="text-sm font-bold">Illustration</p>
      <div className="flex flex-wrap gap-2">
        <label className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
          <input
            type="radio"
            name="artModeUi"
            className="sr-only"
            checked={mode === "auto"}
            onChange={() => {
              setMode("auto");
              stopCamera();
              if (fileRef.current) fileRef.current.value = "";
              setPreview(null);
            }}
          />
          Générée automatiquement
        </label>
        <label className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
          <input
            type="radio"
            name="artModeUi"
            className="sr-only"
            checked={mode === "upload"}
            onChange={() => setMode("upload")}
          />
          Image ou photo
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mode === "upload" && preview ? preview : generated} alt="" className="mx-auto aspect-[5/4] w-full max-w-md object-cover" />
      </div>

      {mode === "auto" ? (
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="reshuffleArt" className="size-4" /> Nouvelle illustration générée à l&apos;enregistrement
        </label>
      ) : (
        <div className="grid gap-2">
          <input
            ref={fileRef}
            type="file"
            name="art"
            accept="image/jpeg,image/png,image/webp,image/gif,image/*"
            className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 py-2 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setPreview(URL.createObjectURL(file));
                setMode("upload");
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <label className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
              Image
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {cameraOn ? (
              <>
                <button type="button" className="mm-btn mm-btn--primary min-h-10 px-4 text-sm" onClick={snapshot}>
                  Capturer
                </button>
                <button type="button" className="mm-btn mm-btn--ghost min-h-10 px-4 text-sm" onClick={stopCamera}>
                  Fermer la caméra
                </button>
              </>
            ) : (
              <button type="button" className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm" onClick={startCamera}>
                Photo
              </button>
            )}
          </div>
          {cameraOn ? (
            <video ref={videoRef} autoPlay playsInline muted className="max-h-72 w-full rounded-xl border-2 border-ink bg-ink object-cover" />
          ) : null}
          {cameraError ? <p className="text-sm font-semibold text-danger">{cameraError}</p> : null}
          <p className="text-xs text-ink-soft">
            Importez une image de l&apos;appareil, prenez une photo, ou capturez via la caméra. JPEG, PNG, WebP ou GIF, 8&nbsp;Mo max.
          </p>
        </div>
      )}
    </div>
  );
}
