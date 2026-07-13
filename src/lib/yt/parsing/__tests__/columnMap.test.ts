import { describe, it, expect } from "vitest";
import { normalizeHeader, suggestMapping } from "../columnMap";

describe("normalizeHeader", () => {
  it("lowercases, strips accents and bracketed units", () => {
    expect(normalizeHeader("Duración media")).toBe("duracion media");
    expect(normalizeHeader("Watch time (hours)")).toBe("watch time");
  });
});

describe("suggestMapping", () => {
  it("maps Spanish general-report headers to canonical fields", () => {
    const mapping = suggestMapping([
      "Fecha",
      "Visualizaciones",
      "Tiempo de reproducción (horas)",
      "Suscriptores ganados",
      "Suscriptores perdidos",
      "Porcentaje de clics de las impresiones",
    ]);
    expect(mapping["Fecha"]).toBe("date");
    expect(mapping["Visualizaciones"]).toBe("views");
    expect(mapping["Tiempo de reproducción (horas)"]).toBe("watch_time_hours");
    expect(mapping["Suscriptores ganados"]).toBe("subscribers_gained");
    expect(mapping["Suscriptores perdidos"]).toBe("subscribers_lost");
    expect(mapping["Porcentaje de clics de las impresiones"]).toBe("impressions_ctr");
  });

  it("maps English general-report headers to the same canonical fields", () => {
    const mapping = suggestMapping(["Date", "Views", "Watch time (hours)", "Impressions click-through rate"]);
    expect(mapping["Date"]).toBe("date");
    expect(mapping["Views"]).toBe("views");
    expect(mapping["Watch time (hours)"]).toBe("watch_time_hours");
    expect(mapping["Impressions click-through rate"]).toBe("impressions_ctr");
  });

  it("maps per-video headers", () => {
    const mapping = suggestMapping(["Video title", "Video ID", "Likes", "Comments", "Shares"]);
    expect(mapping["Video title"]).toBe("title");
    expect(mapping["Video ID"]).toBe("video_id");
    expect(mapping["Likes"]).toBe("likes");
    expect(mapping["Comments"]).toBe("comments");
    expect(mapping["Shares"]).toBe("shares");
  });

  it("maps unrecognized headers to null instead of guessing", () => {
    const mapping = suggestMapping(["Columna rara sin sentido"]);
    expect(mapping["Columna rara sin sentido"]).toBeNull();
  });
});
