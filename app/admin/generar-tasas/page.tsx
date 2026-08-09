"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toPng } from "html-to-image";

interface Currency {
  id: string;
  name: string;
  code: string;
  rate_to_usdt: number;
  lauren_rate?: number;
  lauren_rate_out?: number;
  rate_from_peru?: number;
  rate_from_colombia?: number;
  rate_from_chile?: number;
  rate_from_usa?: number;
  rate_from_ecuador?: number;
  rate_from_brazil?: number;
}

const COUNTRY_ISO_MAP: Record<string, { iso: string; name: string }> = {
  usa: { iso: "us", name: "Estados Unidos" },
  ecu: { iso: "ec", name: "Ecuador" },
  ven: { iso: "ve", name: "Venezuela" },
  col: { iso: "co", name: "Colombia" },
  per: { iso: "pe", name: "Perú" },
  chl: { iso: "cl", name: "Chile" },
  bra: { iso: "br", name: "Brasil" },
};

function FlagIcon({ id, code, name, className = "w-5 h-3.5 sm:w-6 sm:h-4" }: { id?: string; code: string; name?: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  
  const key = (id && COUNTRY_ISO_MAP[id]) ? id : code.toLowerCase();
  const countryInfo = COUNTRY_ISO_MAP[key] || { iso: key, name: name || code };

  if (hasError) {
    return (
      <span className="inline-flex items-center justify-center bg-[#121212] border border-[#b58e45]/40 text-[#b58e45] font-bold text-[8px] rounded px-1 shrink-0">
        {id === "ecu" ? "EC" : code.substring(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${countryInfo.iso}.png`}
      srcSet={`https://flagcdn.com/w80/${countryInfo.iso}.png 2x`}
      alt={`Bandera de ${countryInfo.name}`}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`object-cover rounded shadow-sm shrink-0 ${className}`}
    />
  );
}

export default function AdminGenerarTasas() {
  const router = useRouter();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/login");
        return;
      }

      await fetchRates();
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [router]);

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("id, name, code, rate_to_usdt, lauren_rate, lauren_rate_out, rate_from_peru, rate_from_colombia, rate_from_chile, rate_from_usa, rate_from_ecuador, rate_from_brazil")
      .order("name");

    if (!error && data) {
      const formatted = data.map((c: any) => ({
        ...c,
        lauren_rate: c.lauren_rate ?? c.rate_to_usdt ?? 1,
        lauren_rate_out: c.lauren_rate_out ?? c.lauren_rate ?? 1,
        rate_from_peru: c.rate_from_peru ?? 1,
        rate_from_colombia: c.rate_from_colombia ?? 1,
        rate_from_chile: c.rate_from_chile ?? 1,
        rate_from_usa: c.rate_from_usa ?? 1,
        rate_from_ecuador: c.rate_from_ecuador ?? 1,
        rate_from_brazil: c.rate_from_brazil ?? 1,
      }));
      setCurrencies(formatted);
    }
  };

  const getFormattedDate = () => {
    const now = new Date();
    const formatted = now.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatValue = (val: number, isPercent: boolean = false) => {
    if (isPercent) return `${val}%`;
    if (val >= 1000) return new Intl.NumberFormat("es-ES").format(val);
    if (Number.isInteger(val)) return val.toString();
    return val.toString();
  };

  const handleDownload = async (countryId: string, countryTitle: string) => {
    const element = cardRefs.current[countryId];
    if (!element) return;

    try {
      setDownloadingId(countryId);
      const dataUrl = await toPng(element, { quality: 0.95, cacheBust: true });
      const link = document.createElement("a");
      link.download = `AON-Pay-Resumen-Tasas-${countryTitle.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generando la imagen:", err);
      alert("Hubo un error al descargar la imagen. Intenta de nuevo.");
    } finally {
      setDownloadingId(null);
    }
  };

  const getDestinationsForOrigin = (originId: string) => {
    const list: { id: string; name: string; code: string; rate: string }[] = [];

    currencies.forEach((c) => {
      if (c.id === originId) return;

      if (originId === "ven") {
        const rate = c.lauren_rate_out || 1;
        list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(rate) });
      } else if (originId === "usa") {
        if (c.code === "VES") {
          const usaCurrency = currencies.find((v) => v.id === "usa");
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(usaCurrency?.lauren_rate || 0) });
        } else if (c.id === "ecu") {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_usa || 0, true) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_usa || 0) });
        }
      } else if (originId === "ecu") {
        if (c.code === "VES") {
          const ecuCurrency = currencies.find((v) => v.id === "ecu");
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(ecuCurrency?.lauren_rate || 0) });
        } else if (c.id === "usa") {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_ecuador || 0, true) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_ecuador || 0) });
        }
      } else if (originId === "per") {
        if (c.code === "VES") {
          const perCurrency = currencies.find((v) => v.id === "per");
          list.push({ id: c.id, name: "Venezuela", code: c.code, rate: formatValue(perCurrency?.lauren_rate || 0) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_peru || 0) });
        }
      } else if (originId === "col") {
        if (c.code === "VES") {
          const colCurrency = currencies.find((v) => v.id === "col");
          list.push({ id: c.id, name: "Venezuela", code: c.code, rate: formatValue(colCurrency?.lauren_rate || 0) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_colombia || 0) });
        }
      } else if (originId === "chl") {
        if (c.code === "VES") {
          const chlCurrency = currencies.find((v) => v.id === "chl");
          list.push({ id: c.id, name: "Venezuela", code: c.code, rate: formatValue(chlCurrency?.lauren_rate || 0) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_chile || 0) });
        }
      } else if (originId === "bra") {
        if (c.code === "VES") {
          const braCurrency = currencies.find((v) => v.id === "bra");
          list.push({ id: c.id, name: "Venezuela", code: c.code, rate: formatValue(braCurrency?.lauren_rate || 0) });
        } else {
          list.push({ id: c.id, name: c.name, code: c.code, rate: formatValue(c.rate_from_brazil || 0) });
        }
      }
    });

    return list;
  };

  const ORIGINS = [
    { id: "usa", title: "EE.UU." },
    { id: "per", title: "Perú" },
    { id: "col", title: "Colombia" },
    { id: "chl", title: "Chile" },
    { id: "ecu", title: "Ecuador" },
    { id: "bra", title: "Brasil" },
    { id: "ven", title: "Venezuela" },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] text-[#f4f1ea] flex items-center justify-center p-4">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-2 border-[#b58e45] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#f4f1ea]/60 font-medium">Cargando plantillas de tasas...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] text-[#f4f1ea] flex flex-col items-center p-4 py-8 antialiased">
      <div className="w-full max-w-6xl space-y-6">
        
        {/* ENCABEZADO ADMIN */}
        <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-[#b58e45] text-xs font-bold hover:underline mb-1 inline-block cursor-pointer"
            >
              ← Volver al Panel
            </button>
            <h1 className="text-lg font-bold text-[#f4f1ea]">Resumen Organizado de Tasas</h1>
            <p className="text-xs text-[#f4f1ea]/60">Descarga las placas formateadas en alta definición para WhatsApp</p>
          </div>

          <div className="bg-[#121212]/60 border border-[#b58e45]/30 px-4 py-2 rounded-xl text-center">
            <p className="text-[10px] text-[#f4f1ea]/50 uppercase font-bold">Fecha de las Placas</p>
            <p className="text-xs font-extrabold text-[#b58e45]">{getFormattedDate()}</p>
          </div>
        </div>

        {/* GRILLA DE PLACAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
          {ORIGINS.map((origin) => {
            const destinations = getDestinationsForOrigin(origin.id);
            if (destinations.length === 0) return null;

            return (
              <div key={origin.id} className="flex flex-col items-center space-y-3">
                
                {/* TARJETA 9:16 DE RESUMEN (CANVAS DE EXPORTACIÓN) */}
                <div
                  ref={(el) => { cardRefs.current[origin.id] = el; }}
                  className="w-[360px] h-[640px] bg-[#1a1c1e] text-[#f4f1ea] rounded-3xl p-6 flex flex-col justify-between relative shadow-2xl overflow-hidden border border-[#b58e45]/30 select-none"
                  style={{ fontFamily: "sans-serif" }}
                >
                  {/* MARCA DE AGUA LATERAL */}
                  <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-[#f4f1ea]/10 tracking-widest uppercase pointer-events-none">
                    @vendinero_cambios
                  </div>

                  {/* ENCABEZADO CON LOGO Y FECHA */}
                  <div className="text-center space-y-2 pt-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-12 relative flex items-center justify-center">
                        <img src="/logo.png" alt="AON Pay Logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-xl font-black tracking-wider text-[#f4f1ea] leading-none">
                          AON <span className="text-[#b58e45]">PAY</span>
                        </h2>
                        <span className="bg-[#2c2e30] text-[#b58e45] text-[11px] font-extrabold px-2 py-0.5 rounded border border-[#b58e45]/40 inline-block mt-1">
                          04127591543
                        </span>
                      </div>
                    </div>

                    {/* FECHA DEL DÍA */}
                    <p className="text-[11px] font-semibold text-[#b58e45] uppercase tracking-wider pt-1">
                      📅 {getFormattedDate()}
                    </p>

                    <h3 className="text-base font-extrabold text-[#b58e45] pt-1">
                      Envía desde {origin.title} hacia:
                    </h3>
                  </div>

                  {/* TABLA DE TASAS */}
                  <div className="bg-[#232528] border border-[#b58e45]/20 rounded-2xl p-4 my-2 shadow-inner space-y-2.5">
                    {destinations.map((item, idx) => (
                      <div
                        key={`${origin.id}-${idx}`}
                        className="flex justify-between items-center border-b border-[#121212]/50 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <FlagIcon id={item.id} code={item.code} />
                          <span className="text-sm font-bold text-[#f4f1ea]">{item.name}</span>
                        </div>
                        <span className="text-base font-black text-[#b58e45] tracking-tight">
                          {item.rate}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* FOOTER PUBLICITARIO */}
                  <div className="text-center space-y-1.5 pb-1">
                    <span className="bg-[#2c2e30] text-[#b58e45] text-[10px] font-bold px-3 py-1 rounded-full border border-[#b58e45]/30 inline-block">
                      Tenemos Tasa VIP
                    </span>
                    <p className="text-[10px] font-medium text-[#f4f1ea]/80 leading-tight px-2">
                      Tasas competitivas en el Mercado, Rapidez, seguridad y efectividad en Nuestras transacciones
                    </p>
                  </div>

                </div>

                {/* BOTÓN DE DESCARGA */}
                <button
                  onClick={() => handleDownload(origin.id, origin.title)}
                  disabled={downloadingId === origin.id}
                  className="w-full bg-[#b58e45] hover:bg-[#8b6d32] active:scale-95 text-[#121212] hover:text-[#f4f1ea] font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {downloadingId === origin.id ? (
                    <span className="animate-pulse">Generando Imagen...</span>
                  ) : (
                    <>
                      <span>📥</span>
                      <span>Descargar Imagen ({origin.title})</span>
                    </>
                  )}
                </button>

              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}