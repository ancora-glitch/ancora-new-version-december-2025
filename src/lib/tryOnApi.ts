export const TRY_ON_API_URL =
  "https://nanobanan-tryon-246542949442.europe-north1.run.app/try-on";

const TRY_ON_TIMEOUT_MS = 120_000;

export type TryOnSuccessResponse = {
  success: true;
  resultImage: string;
  processingTimeSeconds?: number;
  requestId?: string;
  model?: string;
};

export type TryOnErrorResponse = {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
};

export type TryOnResponse = TryOnSuccessResponse | TryOnErrorResponse;

export type TryOnUiError = {
  title: string;
  message: string;
  hint?: string;
  code?: string;
};

export class TryOnRequestError extends Error {
  uiError: TryOnUiError;

  constructor(uiError: TryOnUiError) {
    super(uiError.message);
    this.name = "TryOnRequestError";
    this.uiError = uiError;
  }
}

const ERROR_COPY: Record<string, Omit<TryOnUiError, "code">> = {
  VALIDATION_ERROR: {
    title: "Photo could not be processed",
    message: "One of your images is invalid or too large.",
    hint: "Use a JPEG or PNG under 12 MB, with a clear full-body photo.",
  },
  TIMEOUT: {
    title: "Try-on timed out",
    message: "The service did not finish in time.",
    hint: "Please wait a moment and try again.",
  },
  NO_IMAGE: {
    title: "No result generated",
    message: "We could not produce a try-on image this time.",
    hint: "Try a different product photo or upload a clearer full-body picture.",
  },
  BAD_RESPONSE: {
    title: "Unexpected response",
    message: "The try-on service returned an unexpected result.",
    hint: "Please try again in a few moments.",
  },
  API_ERROR: {
    title: "Service unavailable",
    message: "The try-on service hit a temporary error.",
    hint: "Please try again shortly.",
  },
  UPSTREAM_ERROR: {
    title: "Connection issue",
    message: "We could not reach the try-on service.",
    hint: "Check your internet connection and try again.",
  },
  CONFIG_ERROR: {
    title: "Service unavailable",
    message: "Try-on is temporarily unavailable.",
    hint: "Please try again later.",
  },
};

export function getTryOnUiError(code?: string, apiMessage?: string): TryOnUiError {
  if (code && ERROR_COPY[code]) {
    return { code, ...ERROR_COPY[code] };
  }

  return {
    code,
    title: "Try-on failed",
    message: apiMessage?.trim() || "We could not create your try-on.",
    hint: "Please try again with a different photo.",
  };
}

export function getPrepUiError(error: unknown): TryOnUiError {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("garment")) {
    return {
      title: "Product photo unavailable",
      message: "We could not load the selected product image.",
      hint: "Try selecting a different product photo.",
    };
  }

  if (message.includes("read image")) {
    return {
      title: "Upload failed",
      message: "We could not read your uploaded photo.",
      hint: "Try uploading a different JPEG, PNG, or WebP file.",
    };
  }

  return {
    title: "Something went wrong",
    message: "We could not prepare your images for try-on.",
    hint: "Please check your photos and try again.",
  };
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });
}

export async function fileToDataUri(file: File): Promise<string> {
  return blobToDataUri(file);
}

async function urlToDataUriViaFetch(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch garment image");
  }
  return blobToDataUri(await response.blob());
}

function urlToDataUriViaCanvas(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load garment image"));
    img.src = url;
  });
}

export async function urlToDataUri(url: string): Promise<string> {
  try {
    return await urlToDataUriViaFetch(url);
  } catch {
    return urlToDataUriViaCanvas(url);
  }
}

export function resultImageToSrc(resultImage: string): string {
  if (resultImage.startsWith("data:")) return resultImage;
  return `data:image/jpeg;base64,${resultImage}`;
}

function isTryOnResponse(value: unknown): value is TryOnResponse {
  if (!value || typeof value !== "object") return false;
  return "success" in value && typeof (value as TryOnResponse).success === "boolean";
}

export async function submitTryOn(params: {
  personImage: string;
  garmentImage: string;
  mimeType?: string;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<TryOnSuccessResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(TRY_ON_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personImage: params.personImage,
        garmentImage: params.garmentImage,
        ...(params.mimeType ? { mimeType: params.mimeType } : {}),
        ...(params.prompt ? { prompt: params.prompt } : {}),
      }),
      signal: controller.signal,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new TryOnRequestError({
        title: "Unexpected response",
        message: "The try-on service returned an invalid response.",
        hint: "Please try again in a few moments.",
      });
    }

    if (!isTryOnResponse(data)) {
      throw new TryOnRequestError({
        title: "Unexpected response",
        message: "The try-on service returned an unexpected result.",
        hint: "Please try again in a few moments.",
      });
    }

    if (!data.success) {
      throw new TryOnRequestError(getTryOnUiError(data.code, data.error));
    }

    if (!data.resultImage) {
      throw new TryOnRequestError(getTryOnUiError("NO_IMAGE"));
    }

    return data;
  } catch (error) {
    if (error instanceof TryOnRequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      if (params.signal?.aborted) {
        throw error;
      }
      throw new TryOnRequestError(getTryOnUiError("TIMEOUT"));
    }

    if (error instanceof TypeError) {
      throw new TryOnRequestError(getTryOnUiError("UPSTREAM_ERROR"));
    }

    throw new TryOnRequestError({
      title: "Try-on failed",
      message: "Something went wrong while creating your try-on.",
      hint: "Please try again.",
    });
  } finally {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onAbort);
  }
}
