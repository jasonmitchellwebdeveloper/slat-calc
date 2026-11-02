import { ImageResponse } from "next/og";

export const alt = "Slatwise: slat fence calculator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SLATS = Array.from({ length: 9 }, (_, i) => i);

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: 80,
        background: "#f4f5f4",
        color: "#1d1f21",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 56,
        }}
      >
        {SLATS.map((slat) => (
          <div
            key={slat}
            style={{ height: 22, width: "100%", background: "#4a4f54" }}
          />
        ))}
      </div>
      <div style={{ fontSize: 88, fontWeight: 700 }}>Slatwise</div>
      <div style={{ fontSize: 40, color: "#565c62" }}>
        Slat fence calculator: height, materials, cut list and quote
      </div>
    </div>,
    size,
  );
}
