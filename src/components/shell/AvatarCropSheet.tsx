"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  baseScale,
  clampOffset,
  loadAvatarFile,
  releaseImage,
  renderAvatar,
  ZOOM_MAX,
  ZOOM_MIN,
  type CropView,
} from "@/lib/avatar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/** Sisi kotak pratinjau. Cukup besar untuk digeser dengan ibu jari di 320px. */
const VIEWPORT = 240;

/**
 * Memilih bagian foto yang dipakai sebagai avatar.
 *
 * Memotong bagian tengah secara otomatis adalah tebakan, dan pada foto potret
 * tebakan itu sering memotong wajah. Di sini pengguna menggeser dan mengatur
 * zoom sendiri; yang terlihat di dalam kotak persis itulah yang tersimpan.
 */
export function AvatarCropSheet({
  file,
  onClose,
  onSave,
  onError,
}: {
  file: File | null;
  onClose: () => void;
  onSave: (dataUrl: string, bytes: number) => void;
  onError: (message: string) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Memuat berkas yang baru dipilih, dan membebaskan object URL sebelumnya.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let created = "";

    void loadAvatarFile(file).then((result) => {
      if (cancelled) {
        if (result.ok) releaseImage(result.url);
        return;
      }
      if (!result.ok) {
        onError(result.error);
        onClose();
        return;
      }
      created = result.url;
      setImage(result.image);
      setUrl(result.url);
      setZoom(1);
      // Mulai dari bagian tengah — titik awal yang paling sering sudah benar.
      const eff = baseScale(result.image, VIEWPORT);
      setOffset({
        x: (VIEWPORT - result.image.naturalWidth * eff) / 2,
        y: (VIEWPORT - result.image.naturalHeight * eff) / 2,
      });
    });

    return () => {
      cancelled = true;
      if (created) releaseImage(created);
    };
    // onError/onClose sengaja tidak diikutkan: keduanya dibuat ulang tiap render
    // di komponen induk, dan memasukkannya akan memuat ulang berkas tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const view: CropView = { viewport: VIEWPORT, zoom, offsetX: offset.x, offsetY: offset.y };
  const eff = image ? baseScale(image, VIEWPORT) * zoom : 1;

  function moveTo(x: number, y: number) {
    if (!image) return;
    setOffset(clampOffset(image, { ...view, offsetX: x, offsetY: y }));
  }

  function changeZoom(next: number) {
    if (!image) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    // Zoom bertumpu pada titik tengah kotak, bukan sudut kiri-atas, supaya yang
    // sedang dilihat pengguna tetap berada di tempatnya.
    const ratio = clamped / zoom;
    const centre = VIEWPORT / 2;
    const nextX = centre - (centre - offset.x) * ratio;
    const nextY = centre - (centre - offset.y) * ratio;
    setZoom(clamped);
    setOffset(clampOffset(image, { ...view, zoom: clamped, offsetX: nextX, offsetY: nextY }));
  }

  return (
    <Sheet
      open={!!file}
      onClose={onClose}
      title="Atur foto profil"
      description="Geser untuk memindahkan, atur zoom di bawahnya."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={!image}
            onClick={() => {
              if (!image) return;
              const result = renderAvatar(image, view);
              if (!result) {
                onError("Browser ini tidak bisa memproses gambar.");
                return;
              }
              onSave(result.dataUrl, result.bytes);
            }}
          >
            Simpan foto
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="flex justify-center">
          <div
            className="relative touch-none overflow-hidden rounded-2xl bg-surface-3"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              moveTo(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {url ? (
              /* eslint-disable-next-line @next/next/no-img-element -- object URL lokal */
              <img
                src={url}
                alt="Pratinjau foto profil"
                draggable={false}
                className="max-w-none cursor-grab select-none active:cursor-grabbing"
                style={{
                  width: (image?.naturalWidth ?? 0) * eff,
                  height: (image?.naturalHeight ?? 0) * eff,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            ) : (
              <div className="dp-skeleton size-full" aria-hidden />
            )}

            {/* Bingkai lingkaran: bentuk inilah yang nanti tampil di topbar. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                clipPath: "circle(46% at 50% 50%)",
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" aria-label="Perkecil" onClick={() => changeZoom(zoom - 0.25)}>
            <Minus className="size-4" />
          </Button>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            aria-label="Tingkat zoom"
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--brand)]"
          />
          <Button variant="ghost" size="sm" aria-label="Perbesar" onClick={() => changeZoom(zoom + 0.25)}>
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Disimpan sebagai persegi 128px, sekitar 8 KB — tidak menggerus kuota penyimpanan.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!image) return;
              const base = baseScale(image, VIEWPORT);
              setZoom(1);
              setOffset({
                x: (VIEWPORT - image.naturalWidth * base) / 2,
                y: (VIEWPORT - image.naturalHeight * base) / 2,
              });
            }}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
