export interface PreparedReceiptImage {
  mimeType: string;
  imageData: string;
  previewUrl: string;
}

const MAX_SERVER_BYTES = 5 * 1024 * 1024;
const RESIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 2400;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read receipt image'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string): { mimeType: string; imageData: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error('Invalid receipt image data');
  return { mimeType: match[1], imageData: match[2] };
}

async function resizeBrowserImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image canvas is unavailable');
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress receipt image'))),
        'image/jpeg',
        0.82,
      );
    });
  } finally {
    bitmap.close();
  }
}

export async function prepareReceiptImage(file: File): Promise<PreparedReceiptImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  let uploadBlob: Blob = file;

  if (file.size > RESIZE_THRESHOLD_BYTES) {
    try {
      uploadBlob = await resizeBrowserImage(file);
    } catch {
      // Some browser/device formats (notably HEIC) cannot be decoded by canvas.
      // Gemini can still accept the original file when it is within the server limit.
      uploadBlob = file;
    }
  }

  if (uploadBlob.size > MAX_SERVER_BYTES) {
    throw new Error('Receipt image is too large. Please crop it or use a smaller photo.');
  }

  const dataUrl = await readAsDataUrl(uploadBlob);
  const parsed = splitDataUrl(dataUrl);
  return {
    mimeType: parsed.mimeType || file.type,
    imageData: parsed.imageData,
    previewUrl: URL.createObjectURL(file),
  };
}
