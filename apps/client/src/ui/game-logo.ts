import { el } from "./dom";

export function gameLogo(): HTMLHeadingElement {
  const image = el("img");
  image.src = "/branding/bomb-top-logo-v1.png";
  image.alt = "Bomb Top";
  image.width = 1681;
  image.height = 936;
  image.decoding = "async";
  return el("h1", { class: "logo" }, [image]);
}
