import { paintHues, SHEETS } from "../render/sprites";

const sheets = new Map<string, Promise<string>>();

/** The ninja sheet repainted in a player color, as an image URL (made once per color). */
function sheetUrl(color: string): Promise<string> {
  let url = sheets.get(color);
  if (!url) {
    url = (async () => {
      const { ninja } = SHEETS;
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}${ninja.url}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = ninja.width;
      canvas.height = ninja.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, ninja.width, ninja.height);
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
      paintHues(data.data, ninja.hues, rgb);
      ctx.putImageData(data, 0, 0);
      return canvas.toDataURL();
    })();
    sheets.set(color, url);
  }
  return url;
}

/** The ninja for a lobby seat: walks in place on its sheet; the seat moves it around like the mascot. */
export function ninja(color: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "mascot ninja";
  const sprite = document.createElement("i");
  span.appendChild(sprite);
  sheetUrl(color)
    .then((url) => (sprite.style.backgroundImage = `url(${url})`))
    .catch((e) => console.error("ninja preview", e));
  return span;
}
