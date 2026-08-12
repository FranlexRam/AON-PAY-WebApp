import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "AON Pay - Calculadora de Envíos y Remesas";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom, #020617, #0f172a)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow dorado de fondo */}
        <div
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            background: "radial-gradient(circle, rgba(217,119,6,0.15) 0%, rgba(0,0,0,0) 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo de la marca */}
        <img
          src="https://www.aonpayapp.com/favicon.ico"
          alt="AON Pay Logo"
          width="160"
          height="160"
          style={{
            marginBottom: "24px",
            filter: "drop-shadow(0 0 20px rgba(217,119,6,0.4))",
          }}
        />

        {/* Título de la marca */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          AON <span style={{ color: "#f59e0b" }}>Pay</span>
        </div>

        {/* Subtítulo */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: "800px",
          }}
        >
          Calculadora de Envíos y Remesas en Tiempo Real
        </div>

        {/* Borde dorado inferior decorativo */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "6px",
            background: "linear-gradient(to right, #b45309, #f59e0b, #b45309)",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}