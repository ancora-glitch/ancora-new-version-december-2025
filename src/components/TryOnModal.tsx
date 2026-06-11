import { useCallback, useEffect, useRef, useState } from "react";
import { X, Upload, Lock, Check, AlertCircle } from "lucide-react";
import { FiguraLoadingScreen } from "@/components/FiguraLoadingScreen";
import { useTryOnProgress } from "@/hooks/useTryOnProgress";
import {
  fileToDataUri,
  getPrepUiError,
  resultImageToSrc,
  submitTryOn,
  TryOnRequestError,
  type TryOnUiError,
  urlToDataUri,
} from "@/lib/tryOnApi";

const FIGURA_LABS_URL = "https://figuralabs.com";

const FiguraPoweredBy = () => (
  <p className="shrink-0 border-t border-border px-5 py-3 text-center font-sans text-xs text-muted-foreground">
    Powered by{" "}
    <a
      href={FIGURA_LABS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline underline-offset-2"
    >
      Figura Labs
    </a>
  </p>
);

type TryOnPhase = "form" | "processing" | "result" | "error";

interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  productName: string;
}

export const TryOnModal = ({
  isOpen,
  onClose,
  images,
  productName,
}: TryOnModalProps) => {
  const garmentImageUrl = images[0];
  const [phase, setPhase] = useState<TryOnPhase>("form");
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [resultImageSrc, setResultImageSrc] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<TryOnUiError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userImageUrlRef = useRef<string | null>(null);
  const userImageFileRef = useRef<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    progress: loadingProgress,
    statusMessage: loadingStatus,
    start: startLoadingProgress,
    markImagesReady,
    startApiWait,
    complete: completeLoadingProgress,
    reset: resetLoadingProgress,
  } = useTryOnProgress();

  const revokeUserImageUrl = useCallback(() => {
    if (userImageUrlRef.current) {
      URL.revokeObjectURL(userImageUrlRef.current);
      userImageUrlRef.current = null;
    }
  }, []);

  const canSubmit = userImagePreview !== null;

  useEffect(() => {
    if (isOpen) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setPhase("form");
      setUserImagePreview(null);
      setResultImageSrc(null);
      setErrorDetails(null);
      userImageFileRef.current = null;
      revokeUserImageUrl();
      resetLoadingProgress();
    }
  }, [isOpen, revokeUserImageUrl, resetLoadingProgress]);

  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => revokeUserImageUrl();
  }, [revokeUserImageUrl]);

  const handleUserImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    revokeUserImageUrl();
    const url = URL.createObjectURL(file);
    userImageUrlRef.current = url;
    userImageFileRef.current = file;
    setUserImagePreview(url);
    event.target.value = "";
  };

  const handleClearUserImage = () => {
    revokeUserImageUrl();
    userImageFileRef.current = null;
    setUserImagePreview(null);
  };

  const showError = (error: TryOnUiError) => {
    setErrorDetails(error);
    setPhase("error");
  };

  const handleSubmit = async () => {
    if (!canSubmit || !userImageFileRef.current || !garmentImageUrl) return;

    const personFile = userImageFileRef.current;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPhase("processing");
    setErrorDetails(null);
    setResultImageSrc(null);
    startLoadingProgress();

    try {
      const [personImage, garmentImage] = await Promise.all([
        fileToDataUri(personFile),
        urlToDataUri(garmentImageUrl),
      ]);

      if (controller.signal.aborted) return;

      markImagesReady();
      startApiWait();

      const response = await submitTryOn({
        personImage,
        garmentImage,
        mimeType: personFile.type || "image/jpeg",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      await completeLoadingProgress();
      setResultImageSrc(resultImageToSrc(response.resultImage));
      setPhase("result");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        resetLoadingProgress();
        return;
      }

      resetLoadingProgress();

      if (error instanceof TryOnRequestError) {
        showError(error.uiError);
        return;
      }

      showError(getPrepUiError(error));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleRetry = () => {
    resetLoadingProgress();
    setPhase("form");
    setErrorDetails(null);
    setResultImageSrc(null);
  };

  const headerTitle =
    phase === "processing"
      ? "Creating your look"
      : phase === "result"
        ? "Your try-on"
        : phase === "error"
          ? errorDetails?.title ?? "Something went wrong"
          : "See it on you";

  const headerSubtitle =
    phase === "processing"
      ? "This may take up to a minute"
      : phase === "result"
        ? "Here is how it looks on you"
        : phase === "error"
          ? errorDetails?.hint ?? "Please try again"
          : "Upload your photo to try it on";

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={phase === "form" ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Virtual try-on for ${productName}`}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-gradient-to-b from-secondary to-background shadow-xl animate-fade-up"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-serif text-xl text-primary leading-tight">{headerTitle}</p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
            aria-label="Close modal"
          >
            <X size={18} className="text-foreground" />
          </button>
        </div>

        {phase === "processing" ? (
          <FiguraLoadingScreen
            progress={loadingProgress}
            statusMessage={loadingStatus}
          />
        ) : phase === "result" && resultImageSrc ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="overflow-hidden rounded-sm border border-border bg-muted aspect-[3/4]">
              <img
                src={resultImageSrc}
                alt={`Try-on result for ${productName}`}
                className="h-full w-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex w-full items-center justify-center px-8 py-3 min-h-[44px] bg-primary text-primary-foreground font-sans font-medium rounded-sm hover:bg-primary/90 transition-colors"
            >
              Try another photo
            </button>
          </div>
        ) : phase === "error" && errorDetails ? (
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4"
            role="alert"
            aria-live="polite"
          >
            <div className="rounded-sm border border-primary/20 bg-primary/5 p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-primary">
                    {errorDetails.title}
                  </p>
                  <p className="mt-1 font-sans text-sm text-foreground">
                    {errorDetails.message}
                  </p>
                  {errorDetails.hint && (
                    <p className="mt-2 font-sans text-xs text-muted-foreground">
                      {errorDetails.hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex w-full items-center justify-center px-8 py-3 min-h-[44px] bg-primary text-primary-foreground font-sans font-medium rounded-sm hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div>
              <h2 className="font-serif text-lg text-primary leading-tight">
                Upload your image
              </h2>
              <p className="mt-1 font-sans text-sm text-muted-foreground line-clamp-2">
                {productName}
              </p>
            </div>

            <div className="shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleUserImageChange}
              />

              {userImagePreview ? (
                <div className="flex items-center gap-3 rounded-sm border border-border bg-card p-3">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm">
                    <img
                      src={userImagePreview}
                      alt="Your uploaded photo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-sans text-sm font-medium text-primary">
                      <Check size={14} />
                      Your photo is ready
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-sans text-xs text-primary hover:underline underline-offset-2"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleClearUserImage}
                      className="font-sans text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-4 rounded-sm border border-dashed border-border bg-muted/40 px-4 py-5 transition-colors hover:border-primary/40 hover:bg-muted/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-background">
                    <Upload size={18} className="text-primary" strokeWidth={1.5} />
                  </span>
                  <span className="text-left">
                    <span className="block font-sans text-sm font-medium text-foreground">
                      Upload your image
                    </span>
                    <span className="mt-0.5 block font-sans text-xs text-muted-foreground">
                      JPEG, PNG or WebP · full body photo
                    </span>
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center px-8 py-3 min-h-[44px] bg-primary text-primary-foreground font-sans font-medium rounded-sm hover:bg-primary/90 transition-colors touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit
            </button>

            <div className="shrink-0 pb-2 text-center">
              <div className="flex items-center justify-center gap-2 font-sans text-xs text-muted-foreground">
                <Lock size={12} className="shrink-0" />
                <span>Processed instantly · Never stored</span>
              </div>
            </div>
          </div>
        )}

        <FiguraPoweredBy />
      </div>
    </div>
  );
};
