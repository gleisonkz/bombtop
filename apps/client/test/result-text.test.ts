import { describe, expect, it } from "vitest";
import { resultText } from "../src/ui/result-screen";

describe("results screen text", () => {
  it("between rounds: who took the round, and the next one coming", () => {
    expect(resultText("Ana", false, false)).toEqual({ title: "Ana venceu o round!", hint: "Próximo round…" });
    expect(resultText("Ana", true, false)).toEqual({ title: "Você venceu o round!", hint: "Próximo round…" });
    expect(resultText(null, false, false)).toEqual({ title: "Empate!", hint: "Próximo round…" });
  });

  it("the round that wins the match: the champion, then back to the room", () => {
    expect(resultText("Ana", false, true)).toEqual({ title: "Ana venceu a partida!", hint: "Voltando para a sala…" });
    expect(resultText("Ana", true, true)).toEqual({ title: "Você venceu a partida!", hint: "Voltando para a sala…" });
  });

  it("identifica toda a equipe vencedora no TAG", () => {
    expect(resultText("Ana", false, false, "red")).toEqual({ title: "Equipe Vermelha venceu o round!", hint: "Próximo round…" });
    expect(resultText("Ana", true, true, "blue")).toEqual({ title: "Sua equipe venceu a partida!", hint: "Voltando para a sala…" });
    expect(resultText(null, false, false, null)).toEqual({ title: "Empate!", hint: "Próximo round…" });
  });
});
