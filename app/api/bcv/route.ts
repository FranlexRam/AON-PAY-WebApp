import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Consultamos la API pública y confiable de DolarApi Venezuela (datos del BCV)
    const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
      next: { revalidate: 300 }, // Cachea la respuesta por 5 minutos (300 segundos)
    });

    if (!response.ok) {
      throw new Error("Error consultando la API externa");
    }

    const data = await response.json();

    // Intentamos obtener también el Euro si la API lo provee en el endpoint general
    let eurRate = null;
    try {
      const eurRes = await fetch("https://ve.dolarapi.com/v1/euros/oficial", {
        next: { revalidate: 300 },
      });
      if (eurRes.ok) {
        const eurData = await eurRes.json();
        eurRate = eurData.promedio;
      }
    } catch {
      // Si falla la consulta del Euro, permitimos que devuelva al menos el Dólar
    }

    return NextResponse.json({
      usd: data.promedio,
      eur: eurRate,
      updatedAt: data.fechaActualizacion,
    });
  } catch (error) {
    console.error("[BCV API ERROR]:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las tasas oficiales" },
      { status: 500 }
    );
  }
}