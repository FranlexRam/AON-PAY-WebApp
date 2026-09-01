'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabasePlexus as supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  client_phone: string;
  origin_country: string;
  dest_country: string;
  origin_currency: string;
  dest_currency: string;
  amount_sent: number;
  amount_received: number;
  usd_equivalent: number;
  rate_applied: string;
  status: string;
  created_at: string;
}

interface Client {
  phone: string;
  full_name: string | null;
  status: string;
  contact_type: string;
  preferred_origin_country: string | null;
  preferred_dest_country: string | null;
  is_verified: boolean;
  created_at: string;
}

export default function AdminCrmPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contactTypeFilter, setContactTypeFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);

  // Paginación de Historial
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    fetchCrmData();

    const txChannel = supabase
      .channel('realtime_transactions_crm')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          setTransactions((prev) => [payload.new as Transaction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
    };
  }, []);

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const [txRes, clientsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (txRes.data) setTransactions(txRes.data as Transaction[]);
      if (clientsRes.data) setClients(clientsRes.data as Client[]);
    } catch (err) {
      console.error('Error cargando métricas de CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  const dateFilteredTransactions = useMemo(() => {
    if (dateRangeFilter === 'all') return transactions;
    const now = new Date();
    return transactions.filter((tx) => {
      const txDate = new Date(tx.created_at);
      const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
      if (dateRangeFilter === 'today') return diffDays <= 1;
      if (dateRangeFilter === '7d') return diffDays <= 7;
      if (dateRangeFilter === '30d') return diffDays <= 30;
      return true;
    });
  }, [transactions, dateRangeFilter]);

  const uniqueRoutes = useMemo(() => {
    const routesSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.origin_country && tx.dest_country) {
        routesSet.add(`${tx.origin_country} ➔ ${tx.dest_country}`);
      }
    });
    return Array.from(routesSet).sort();
  }, [transactions]);

  const totalVolumeUSD = useMemo(() => {
    return dateFilteredTransactions.reduce((acc, curr) => acc + (curr.usd_equivalent || 0), 0);
  }, [dateFilteredTransactions]);

  const totalTransactionsCount = dateFilteredTransactions.length;

  const averageTicketUSD = useMemo(() => {
    if (totalTransactionsCount === 0) return 0;
    return totalVolumeUSD / totalTransactionsCount;
  }, [totalVolumeUSD, totalTransactionsCount]);

  const topVolumeClient = useMemo(() => {
    if (dateFilteredTransactions.length === 0) return { phone: 'N/A', name: 'N/A', amount: 0 };
    const userTotals: Record<string, number> = {};
    dateFilteredTransactions.forEach((tx) => {
      userTotals[tx.client_phone] = (userTotals[tx.client_phone] || 0) + (tx.usd_equivalent || 0);
    });
    const sorted = Object.entries(userTotals).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return { phone: 'N/A', name: 'N/A', amount: 0 };
    const topPhone = sorted[0][0];
    const clientData = clients.find((c) => c.phone === topPhone);
    return {
      phone: topPhone,
      name: clientData?.full_name || 'Sin registrar',
      amount: sorted[0][1]
    };
  }, [dateFilteredTransactions, clients]);

  const mostLoyalClient = useMemo(() => {
    if (dateFilteredTransactions.length === 0) return { phone: 'N/A', name: 'N/A', count: 0 };
    const userCounts: Record<string, number> = {};
    dateFilteredTransactions.forEach((tx) => {
      userCounts[tx.client_phone] = (userCounts[tx.client_phone] || 0) + 1;
    });
    const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return { phone: 'N/A', name: 'N/A', count: 0 };
    const topPhone = sorted[0][0];
    const clientData = clients.find((c) => c.phone === topPhone);
    return {
      phone: topPhone,
      name: clientData?.full_name || 'Sin registrar',
      count: sorted[0][1]
    };
  }, [dateFilteredTransactions, clients]);

  const conversionRate = useMemo(() => {
    if (dateFilteredTransactions.length === 0) return 0;
    const handoverCount = dateFilteredTransactions.filter(
      (tx) => tx.status && tx.status.toLowerCase() !== 'quoted'
    ).length;
    return (handoverCount / dateFilteredTransactions.length) * 100;
  }, [dateFilteredTransactions]);

  const routeDistribution = useMemo(() => {
    if (dateFilteredTransactions.length === 0) return [];
    const counts: Record<string, number> = {};
    dateFilteredTransactions.forEach((tx) => {
      const rKey = `${tx.origin_country || 'Origen'} ➔ ${tx.dest_country || 'Destino'}`;
      counts[rKey] = (counts[rKey] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([route, count]) => ({
        route,
        count,
        percentage: ((count / dateFilteredTransactions.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }, [dateFilteredTransactions]);

  const peakStats = useMemo(() => {
    const daysMap: Record<string, number> = {
      'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0
    };
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hoursMap: Record<number, number> = {};

    dateFilteredTransactions.forEach((tx) => {
      const d = new Date(tx.created_at);
      const dayName = dayNames[d.getDay()];
      if (daysMap[dayName] !== undefined) daysMap[dayName] += 1;

      const hour = d.getHours();
      hoursMap[hour] = (hoursMap[hour] || 0) + 1;
    });

    const topDayEntry = Object.entries(daysMap).sort((a, b) => b[1] - a[1])[0];
    const topHourEntry = Object.entries(hoursMap).sort((a, b) => b[1] - a[1])[0];

    const formatHour = (hStr: string) => {
      const h = parseInt(hStr, 10);
      if (isNaN(h)) return 'N/A';
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formatted = h % 12 === 0 ? 12 : h % 12;
      return `${formatted}:00 ${ampm}`;
    };

    return {
      peakDay: topDayEntry && topDayEntry[1] > 0 ? `${topDayEntry[0]} (${topDayEntry[1]} ops)` : 'Sin datos',
      peakHour: topHourEntry ? `${formatHour(topHourEntry[0])} (${topHourEntry[1]} ops)` : 'Sin datos'
    };
  }, [dateFilteredTransactions]);

  const consolidatedClients = useMemo(() => {
    const txMap: Record<string, { count: number; totalUsd: number }> = {};
    dateFilteredTransactions.forEach((tx) => {
      if (!txMap[tx.client_phone]) {
        txMap[tx.client_phone] = { count: 0, totalUsd: 0 };
      }
      txMap[tx.client_phone].count += 1;
      txMap[tx.client_phone].totalUsd += tx.usd_equivalent || 0;
    });

    return clients
      .map((c) => ({
        ...c,
        txCount: txMap[c.phone]?.count || 0,
        totalVolume: txMap[c.phone]?.totalUsd || 0
      }))
      .filter((c) => {
        const matchesSearch =
          c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.full_name && c.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesType = contactTypeFilter === 'all' || c.contact_type === contactTypeFilter;
        const clientRoute = `${c.preferred_origin_country || ''} ➔ ${c.preferred_dest_country || ''}`;
        const matchesRoute = routeFilter === 'all' || clientRoute.includes(routeFilter);

        return matchesSearch && matchesStatus && matchesType && matchesRoute;
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clients, dateFilteredTransactions, searchTerm, statusFilter, contactTypeFilter, routeFilter]);

  const filteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((tx) => {
      if (selectedClientPhone && tx.client_phone !== selectedClientPhone) return false;
      if (searchTerm) {
        const matchesPhone = tx.client_phone.includes(searchTerm);
        const matchesRoute = `${tx.origin_country} ${tx.dest_country}`.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesPhone && !matchesRoute) return false;
      }
      if (routeFilter !== 'all') {
        const txRoute = `${tx.origin_country} ➔ ${tx.dest_country}`;
        if (txRoute !== routeFilter) return false;
      }
      return true;
    });
  }, [dateFilteredTransactions, selectedClientPhone, searchTerm, routeFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f4f1ea] p-4 sm:p-8 lg:p-10 font-sans antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#b58e45]/20 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#f4f1ea] flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-[#b58e45] inline-block shadow-[0_0_14px_#b58e45]" />
              AON Pay — BI & CRM Operativo
            </h1>
            <p className="text-sm sm:text-base text-[#f4f1ea]/70 mt-1 font-medium">
              Telemetría determinista de Cyra, fidelidad y analítica multidivisa
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] transition-all"
            >
              ← Gestor de Tasas
            </Link>
            <button
              onClick={fetchCrmData}
              className="px-5 py-2.5 rounded-xl bg-[#b58e45] hover:bg-[#9d7938] text-sm font-black text-[#0d0d0d] transition-all shadow-[0_4px_16px_rgba(181,142,69,0.3)] cursor-pointer"
            >
              Actualizar Datos
            </button>
          </div>
        </header>

        {/* BARRA DE FILTRO TEMPORAL GLOBAL */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#121212] p-4 rounded-2xl border border-[#b58e45]/20">
          <div className="text-sm font-bold text-[#f4f1ea]/80 flex items-center gap-2">
            <span className="text-base">📅</span>
            <span>Rango de Análisis:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {[
              { id: 'all', label: 'Todo el Historial' },
              { id: 'today', label: 'Hoy' },
              { id: '7d', label: 'Últimos 7 Días' },
              { id: '30d', label: 'Últimos 30 Días' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => { setDateRangeFilter(btn.id); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  dateRangeFilter === btn.id
                    ? 'bg-[#b58e45] text-[#121212] shadow-md scale-105'
                    : 'bg-[#0d0d0d] text-[#f4f1ea]/70 hover:text-[#f4f1ea] border border-[#b58e45]/20'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 TARJETAS DE KPIS PRINCIPALES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Volumen Cotizado</span>
            <div className="text-2xl lg:text-3xl font-black text-[#b58e45] my-2">
              ${totalVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Equivalente global USD</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Operaciones</span>
            <div className="text-2xl lg:text-3xl font-black text-[#f4f1ea] my-2">
              {totalTransactionsCount}
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Cotizaciones registradas</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Ticket Promedio</span>
            <div className="text-2xl lg:text-3xl font-black text-[#cdead2] my-2">
              ${averageTicketUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Por cotización (USD)</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Cliente Más Fiel</span>
            <div className="text-sm font-bold text-[#f4f1ea] truncate my-2" title={mostLoyalClient.name}>
              {mostLoyalClient.name}
            </div>
            <span className="text-xs text-[#b58e45] font-bold">{mostLoyalClient.count} cotizaciones</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Cliente Top (Volumen)</span>
            <div className="text-sm font-bold text-[#f4f1ea] truncate my-2" title={topVolumeClient.name}>
              {topVolumeClient.name}
            </div>
            <span className="text-xs text-emerald-400 font-bold">
              ${topVolumeClient.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Tasa de Handover</span>
            <div className="text-2xl lg:text-3xl font-black text-[#f4f1ea] my-2">
              {conversionRate.toFixed(1)}%
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Pase a atención humana</span>
          </div>
        </section>

        {/* DISTRIBUCIÓN DE RUTAS Y PICOS DE TRÁFICO */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Barras de Distribución de Rutas */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-4 shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#f4f1ea]">Distribución de Operaciones por Ruta</h3>
                <p className="text-xs text-[#f4f1ea]/60">Participación porcentual sobre la matriz de rutas</p>
              </div>
              <span className="text-sm font-bold text-[#b58e45] bg-[#b58e45]/10 px-3 py-1 rounded-lg border border-[#b58e45]/30">
                {routeDistribution.length} Rutas Activas
              </span>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {routeDistribution.length === 0 ? (
                <p className="text-sm text-[#f4f1ea]/40 py-6 text-center">No hay cotizaciones para el rango seleccionado.</p>
              ) : (
                routeDistribution.map((item) => (
                  <div key={item.route} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-[#f4f1ea]">{item.route}</span>
                      <span className="text-[#f4f1ea]/70">
                        <strong className="text-[#b58e45]">{item.count}</strong> ops ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#0d0d0d] h-3 rounded-full overflow-hidden border border-[#b58e45]/20">
                      <div
                        className="bg-gradient-to-r from-[#b58e45] to-[#cdead2] h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Telemetría de Picos */}
          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between space-y-5 shadow-lg">
            <div>
              <h3 className="text-base font-bold text-[#f4f1ea]">Picos de Mayor Demanda</h3>
              <p className="text-xs text-[#f4f1ea]/60">Horarios y días con mayor concurrencia en Cyra</p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-[#b58e45]/20">
                <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Día Pico de la Semana</span>
                <p className="text-lg font-black text-[#b58e45] mt-1">{peakStats.peakDay}</p>
              </div>

              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-[#b58e45]/20">
                <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Hora Pico del Día (GMT-4)</span>
                <p className="text-lg font-black text-[#cdead2] mt-1">{peakStats.peakHour}</p>
              </div>
            </div>

            <p className="text-xs text-[#f4f1ea]/50 text-center font-medium">
              Basado en timestamps reales de mensajes en Supabase
            </p>
          </div>
        </section>

        {/* DIRECTORIO DE CLIENTES Y SEGMENTACIÓN */}
        <section className="p-6 sm:p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#f4f1ea]">Directorio de Clientes & Fidelidad</h2>
              <p className="text-sm text-[#f4f1ea]/60">Haz clic en cualquier fila para filtrar su historial específico abajo</p>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por teléfono o nombre..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 focus:border-[#b58e45] text-sm text-[#f4f1ea] outline-none w-60"
              />

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Modos (Todos)</option>
                <option value="bot">🤖 Modo Bot</option>
                <option value="human">👤 Modo Humano</option>
              </select>

              <select
                value={contactTypeFilter}
                onChange={(e) => { setContactTypeFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Tipos (Todos)</option>
                <option value="client">Cliente Autorizado</option>
                <option value="non_client">No Cliente</option>
              </select>

              <select
                value={routeFilter}
                onChange={(e) => { setRouteFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium max-w-[190px]"
              >
                <option value="all">Rutas (Todas)</option>
                {uniqueRoutes.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {selectedClientPhone && (
                <button
                  onClick={() => setSelectedClientPhone(null)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-bold transition-all cursor-pointer"
                >
                  Limpiar Filtro Cliente ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/15">
            <table className="w-full text-left text-sm text-[#f4f1ea]">
              <thead className="bg-[#0d0d0d] border-b border-[#b58e45]/20 text-[#f4f1ea]/70 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="py-4 px-5">Contacto</th>
                  <th className="py-4 px-5">Directorio</th>
                  <th className="py-4 px-5">Ruta Habitual</th>
                  <th className="py-4 px-5 text-center">Frecuencia</th>
                  <th className="py-4 px-5 text-right">Volumen USD</th>
                  <th className="py-4 px-5 text-center">Estado Cyra</th>
                  <th className="py-4 px-5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/10 bg-[#121212]/40">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      Cargando datos de Supabase...
                    </td>
                  </tr>
                ) : consolidatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      No se encontraron clientes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  consolidatedClients.map((client) => {
                    const isSelected = selectedClientPhone === client.phone;
                    return (
                      <tr
                        key={client.phone}
                        onClick={() => setSelectedClientPhone(isSelected ? null : client.phone)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#b58e45]/20 border-l-4 border-[#b58e45]' : 'hover:bg-[#b58e45]/5'
                        }`}
                      >
                        <td className="py-4 px-5 font-medium">
                          <div className="font-bold text-base text-[#f4f1ea]">{client.full_name || 'Sin Nombre'}</div>
                          <div className="text-xs text-[#f4f1ea]/60 font-semibold mt-0.5">+{client.phone}</div>
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              client.contact_type === 'client'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
                            }`}
                          >
                            {client.contact_type === 'client' ? 'Cliente' : 'No Cliente'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-[#f4f1ea]/90 font-medium">
                          {client.preferred_origin_country || 'N/A'} ➔ {client.preferred_dest_country || 'N/A'}
                        </td>
                        <td className="py-4 px-5 text-center font-bold text-base text-[#f4f1ea]">
                          {client.txCount}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-base text-[#b58e45]">
                          ${client.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                              client.status === 'bot'
                                ? 'bg-[#b58e45]/15 text-[#b58e45] border border-[#b58e45]/40'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {client.status === 'bot' ? '🤖 BOT' : '👤 HUMANO'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className="text-xs text-[#b58e45] hover:underline font-bold">
                            {isSelected ? 'Ver Todos' : 'Filtrar Historial ➔'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* HISTORIAL TOTAL DE COTIZACIONES CON PAGINACIÓN */}
        <section className="p-6 sm:p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#f4f1ea]">
                Auditoría Completa de Cotizaciones ({filteredTransactions.length} registros)
              </h2>
              {selectedClientPhone && (
                <p className="text-sm text-[#b58e45] font-bold mt-1">
                  Mostrando únicamente transacciones de: +{selectedClientPhone}
                </p>
              )}
            </div>

            {/* Selector de Tamaño de Página */}
            <div className="flex items-center gap-2 text-sm text-[#f4f1ea]/80 font-medium">
              <span>Mostrar:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-bold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/15">
            <table className="w-full text-left text-sm text-[#f4f1ea]">
              <thead className="bg-[#0d0d0d] border-b border-[#b58e45]/20 text-[#f4f1ea]/70 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="py-4 px-5">Fecha / Hora</th>
                  <th className="py-4 px-5">Cliente</th>
                  <th className="py-4 px-5">Corredor</th>
                  <th className="py-4 px-5 text-right">Envía</th>
                  <th className="py-4 px-5 text-right">Recibe</th>
                  <th className="py-4 px-5 text-right">Tasa Aplicada</th>
                  <th className="py-4 px-5 text-right">Ref. USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/10 bg-[#121212]/40">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      Cargando historial...
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      No hay transacciones que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#b58e45]/5 transition-colors">
                      <td className="py-4 px-5 text-xs font-semibold text-[#f4f1ea]/70">
                        {new Date(tx.created_at).toLocaleString('es-VE', {
                          timeZone: 'America/Caracas',
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-4 px-5 font-bold text-sm text-[#f4f1ea]">+{tx.client_phone}</td>
                      <td className="py-4 px-5 text-sm text-[#f4f1ea]/90 font-medium">
                        {tx.origin_country} ➔ {tx.dest_country}
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-sm text-[#f4f1ea]">
                        {tx.amount_sent.toLocaleString()} {tx.origin_currency}
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-sm text-emerald-400">
                        {tx.amount_received.toLocaleString()} {tx.dest_currency}
                      </td>
                      <td className="py-4 px-5 text-right text-xs font-medium text-[#f4f1ea]/70">
                        {tx.rate_applied || 'Tasa estándar'}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-sm text-[#b58e45]">
                        ${(tx.usd_equivalent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Controles de Paginación */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-5 border-t border-[#b58e45]/15 text-sm text-[#f4f1ea]/70 font-medium">
            <span>
              Página <strong className="text-[#f4f1ea] font-bold">{currentPage}</strong> de <strong className="text-[#f4f1ea] font-bold">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}