import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type DownloadBiltyPagesParams = {
  biltyElement: HTMLElement;
  termsElement: HTMLElement;
  fileName: string;
};

const sanitizeFileName = (value: string) =>
  (value || "bilty")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );
};

const prepareElementForCapture = async (element: HTMLElement) => {
  if ("fonts" in document) {
    await document.fonts.ready;
  }

  await waitForImages(element);
};

const captureElement = async (element: HTMLElement) =>
  html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth),
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
  });

const fitCanvasOnPage = (pdf: jsPDF, canvas: HTMLCanvasElement) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const canvasRatio = canvas.width / canvas.height;
  const pageRatio = availableWidth / availableHeight;

  let renderWidth = availableWidth;
  let renderHeight = availableHeight;

  if (canvasRatio > pageRatio) {
    renderHeight = renderWidth / canvasRatio;
  } else {
    renderWidth = renderHeight * canvasRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    x,
    y,
    renderWidth,
    renderHeight,
    undefined,
    "FAST"
  );
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to create image file."));
    }, "image/png");
  });

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
};

export const downloadBiltyPdf = async ({
  biltyElement,
  termsElement,
  fileName,
}: DownloadBiltyPagesParams) => {
  await Promise.all([
    prepareElementForCapture(biltyElement),
    prepareElementForCapture(termsElement),
  ]);

  const [biltyCanvas, termsCanvas] = await Promise.all([
    captureElement(biltyElement),
    captureElement(termsElement),
  ]);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  fitCanvasOnPage(pdf, biltyCanvas);
  pdf.addPage("a4", "portrait");
  fitCanvasOnPage(pdf, termsCanvas);
  pdf.save(`${sanitizeFileName(fileName)}.pdf`);
};

export const downloadBiltyImages = async ({
  biltyElement,
  termsElement,
  fileName,
}: DownloadBiltyPagesParams) => {
  const safeFileName = sanitizeFileName(fileName);

  await Promise.all([
    prepareElementForCapture(biltyElement),
    prepareElementForCapture(termsElement),
  ]);

  const [biltyCanvas, termsCanvas] = await Promise.all([
    captureElement(biltyElement),
    captureElement(termsElement),
  ]);

  const [biltyBlob, termsBlob] = await Promise.all([
    canvasToBlob(biltyCanvas),
    canvasToBlob(termsCanvas),
  ]);

  triggerBlobDownload(biltyBlob, `${safeFileName}-page-1-bilty.png`);
  window.setTimeout(() => {
    triggerBlobDownload(termsBlob, `${safeFileName}-page-2-terms-and-conditions.png`);
  }, 150);
};
