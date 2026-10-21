"use client";

import { useEffect, useRef, useState } from "react";
import { ImageError, prepareImage } from "@/lib/client/image";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

export interface ImagePickerLabels {
  /** Bouton : choisir une image de l'appareil (ordinateur, galerie du téléphone). */
  image: string;
  /** Bouton : prendre une photo avec l'appareil photo. */
  photo: string;
  capture: string;
  cancel: string;
  preparing: string;
  cameraBlocked: string;
  cameraInsecure: string;
  unreadable: string;
  notImage: string;
}

/**
 * Deux boutons, « Image » et « Photo » :
 * - Image : ouvre les fichiers de l'ordinateur ou la galerie du téléphone ;
 * - Photo : sur téléphone et tablette, ouvre directement l'appareil photo ;
 *   sur ordinateur, filme avec la webcam puis « Capturer ».
 * L'image choisie est préparée (taille, orientation, compression) avant d'être
 * transmise : `onPick` reçoit un fichier JPEG léger, prêt à être envoyé.
 */
export function ImagePicker({ labels, onPick, disabled = false }: { labels: ImagePickerLabels; onPick: (file: File) => void; disabled?: boolean }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function use(file: Blob | undefined, name?: string) {
    if (!file) return;
    setProblem(null);
    setPreparing(true);
    try {
      onPick(await prepareImage(file, name));
    } catch (error) {
      setProblem(error instanceof ImageError && error.code === "not_image" ? labels.notImage : labels.unreadable);
    } finally {
      setPreparing(false);
    }
  }

  async function photo() {
    setProblem(null);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // Téléphone, tablette, ou caméra indisponible : l'appareil photo du système (le plus fiable).
    if (touch || !navigator.mediaDevices?.getUserMedia) {
      if (!window.isSecureContext && !touch) setProblem(labels.cameraInsecure);
      captureRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setProblem(labels.cameraBlocked);
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
        stopCamera();
        if (blob) void use(blob, "photo.jpg");
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="min-h-10 gap-2 px-4 text-sm" disabled={disabled || preparing} onClick={() => galleryRef.current?.click()}>
          <ImageIcon /> {labels.image}
        </Button>
        {cameraOn ? null : (
          <Button type="button" variant="secondary" className="min-h-10 gap-2 px-4 text-sm" disabled={disabled || preparing} onClick={photo}>
            <CameraIcon /> {labels.photo}
          </Button>
        )}
        {preparing ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft" role="status">
            <Spinner /> {labels.preparing}
          </span>
        ) : null}
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void use(e.target.files?.[0], e.target.files?.[0]?.name);
          e.target.value = "";
        }}
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void use(e.target.files?.[0], "photo.jpg");
          e.target.value = "";
        }}
      />
      {cameraOn ? (
        <div className="grid gap-2 rounded-2xl border-2 border-ink bg-ink p-2">
          <video ref={videoRef} autoPlay playsInline muted className="max-h-80 w-full rounded-xl object-cover" />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" className="min-h-10 gap-2 px-5 text-sm" onClick={snapshot}>
              <CameraIcon /> {labels.capture}
            </Button>
            <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={stopCamera}>
              {labels.cancel}
            </Button>
          </div>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
