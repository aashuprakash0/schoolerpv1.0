'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_locked: boolean;
};

type FeeHead = {
  id: string;
  name: string;
  category: string | null;
  is_recurring: boolean | null;
};

type FeeStructure = {
  id: string;
  academic_year_id: string | null;
  class_name: string | null;
  fee_head_id: string | null;
  amount: number | null;
  frequency: string;
  hostel_only: boolean;
  vehicle_area: string | null;
  applicable_to: string | null;
  pricing_type: string;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
  notes: string | null;
  fee_heads?: FeeHead[] | null;
};

const CLASSES = [
  'Nursery',
  'LKG',
  'UKG',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
];

const ROUTES = [
  { route: 'Route A', area: 'Mansapur', amount: 1000 },
  { route: 'Route B', area: 'Mahdeva', amount: 1000 },
  { route: 'Route C', area: 'Sonvarsha', amount: 800 },
  { route: 'Route D', area: 'Nari', amount: 800 },
  { route: 'Route E', area: 'Tharuahi', amount: 700 },
  { route: 'Route F', area: 'Tulsuyahi', amount: 700 },
  { route: 'Route G', area: 'Dhata tol', amount: 700 },
  { route: 'Route H', area: 'Harbhanga', amount: 600 },
  { route: 'Route I', area: 'Laukahi', amount: 500 },
];

export default function FeeStructurePage() {
  const sb = useMemo(() => supabaseBrowser(), []);

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');
  const [copyPrevious, setCopyPrevious] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const selectedYearData = years.find((y) => y.id === selectedYear);

  async function loadData() {
    setLoading(true);
    setError('');

    const [yearsResult, headsResult, structuresResult] =
      await Promise.all([
        sb
          .from('academic_years')
          .select('*')
          .order('start_date', { ascending: false }),

        sb
          .from('fee_heads')
          .select('*')
          .order('name'),

        sb
          .from('fee_structures')
          .select(`
            id,
            academic_year_id,
            class_name,
            fee_head_id,
            amount,
            frequency,
            hostel_only,
            vehicle_area,
            applicable_to,
            pricing_type,
            effective_from,
            effective_to,
            active,
            notes,
            fee_heads (
              id,
              name,
              category,
              is_recurring
            )
          `)
          .order('created_at', { ascending: true }),
      ]);

    if (yearsResult.error) {
      setError(yearsResult.error.message);
      setLoading(false);
      return;
    }

    if (headsResult.error) {
      setError(headsResult.error.message);
      setLoading(false);
      return;
    }

    if (structuresResult.error) {
      setError(structuresResult.error.message);
      setLoading(false);
      return;
    }

    setYears(yearsResult.data || []);
    setHeads(headsResult.data || []);

    // Supabase returns the joined fee_heads relation as an array.
    setStructures((structuresResult.data || []) as unknown as FeeStructure[]);

    const activeYear =
      (yearsResult.data || []).find((y) => y.is_active) ||
      (yearsResult.data || [])[0];

    if (activeYear && !selectedYear) {
      setSelectedYear(activeYear.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yearStructures = structures.filter(
    (s) => s.academic_year_id === selectedYear
  );

  const schoolFees = yearStructures.filter(
    (s) =>
      s.fee_heads?.[0]?.name === 'Composite Fee' &&
      !s.vehicle_area &&
      !s.hostel_only
  );

  const hostelFees = yearStructures.filter(
    (s) => s.fee_heads?.[0]?.name === 'Hostel Fee'
  );

  const vehicleFees = yearStructures.filter(
    (s) => s.fee_heads?.[0]?.name === 'Vehicle Fee'
  );

  const oneTimeFees = yearStructures.filter(
    (s) =>
      s.frequency === 'One-time' &&
      s.fee_heads?.[0]?.name !== 'Composite Fee' &&
      s.fee_heads?.[0]?.name !== 'Vehicle Fee' &&
      s.fee_heads?.[0]?.name !== 'Hostel Fee'
  );

  function findSchoolFee(className: string) {
    return schoolFees.find((s) => s.class_name === className);
  }

  function findVehicleFee(area: string) {
    return vehicleFees.find((s) =>
      s.vehicle_area?.toLowerCase().includes(area.toLowerCase())
    );
  }

  function findHostelFee() {
    return hostelFees[0];
  }

  async function saveAmount(id: string) {
    const amount = Number(editAmount);

    if (Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid amount.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error } = await sb
      .from('fee_structures')
      .update({
        amount,
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setEditingId(null);
    setEditAmount('');
    setMessage('Fee updated successfully.');

    await loadData();
    setSaving(false);
  }

  async function createNewAcademicYear() {
    if (!newYearName || !newYearStart || !newYearEnd) {
      setError('Enter session name, start date and end date.');
      return;
    }

    if (years.some((y) => y.name === newYearName)) {
      setError('This academic year already exists.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { data: newYear, error: yearError } = await sb
      .from('academic_years')
      .insert({
        name: newYearName,
        start_date: newYearStart,
        end_date: newYearEnd,
        is_active: false,
        is_locked: false,
      })
      .select()
      .single();

    if (yearError || !newYear) {
      setError(yearError?.message || 'Could not create academic year.');
      setSaving(false);
      return;
    }

    if (copyPrevious && selectedYear) {
      const previousStructures = structures.filter(
        (s) => s.academic_year_id === selectedYear
      );

      if (previousStructures.length > 0) {
        const copiedRows = previousStructures.map((s) => ({
          academic_year_id: newYear.id,
          class_name: s.class_name,
          fee_head_id: s.fee_head_id,
          amount: s.amount,
          frequency: s.frequency,
          hostel_only: s.hostel_only,
          vehicle_area: s.vehicle_area,
          applicable_to: s.applicable_to,
          pricing_type: s.pricing_type,
          effective_from: newYearStart,
          effective_to: null,
          active: true,
          notes: `Copied from ${
            selectedYearData?.name || 'previous session'
          }`,
        }));

        const { error: copyError } = await sb
          .from('fee_structures')
          .insert(copiedRows);

        if (copyError) {
          setError(
            `Academic year created, but fee copy failed: ${copyError.message}`
          );
          await loadData();
          setSaving(false);
          return;
        }
      }
    }

    const createdName = newYearName;

    setNewYearName('');
    setNewYearStart('');
    setNewYearEnd('');

    setMessage(
      `${createdName} created successfully${
        copyPrevious ? ' with previous fees copied.' : '.'
      }`
    );

    setSelectedYear(newYear.id);

    await loadData();
    setSaving(false);
  }

  async function activateYear(id: string) {
    const year = years.find((y) => y.id === id);

    if (!year) return;

    if (
      !confirm(
        `Activate ${year.name}?\n\nThis will make ${year.name} the current academic year.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error: deactivateError } = await sb
      .from('academic_years')
      .update({ is_active: false })
      .neq('id', id);

    if (deactivateError) {
      setError(deactivateError.message);
      setSaving(false);
      return;
    }

    const { error: activateError } = await sb
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', id);

    if (activateError) {
      setError(activateError.message);
      setSaving(false);
      return;
    }

    setMessage(`${year.name} is now the active academic year.`);

    await loadData();
    setSaving(false);
  }

  async function addFeeStructure(
    feeHeadName: string,
    amount: number | null,
    options: {
      className?: string | null;
      frequency?: string;
      hostelOnly?: boolean;
      vehicleArea?: string | null;
      applicableTo?: string | null;
      pricingType?: string;
    } = {}
  ) {
    if (!selectedYear) {
      setError('Select an academic year first.');
      return;
    }

    const head = heads.find((h) => h.name === feeHeadName);

    if (!head) {
      setError(`Fee head "${feeHeadName}" was not found.`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error } = await sb.from('fee_structures').insert({
      academic_year_id: selectedYear,
      class_name: options.className ?? null,
      fee_head_id: head.id,
      amount,
      frequency: options.frequency || 'Monthly',
      hostel_only: options.hostelOnly || false,
      vehicle_area: options.vehicleArea ?? null,
      applicable_to: options.applicableTo ?? null,
      pricing_type: options.pricingType || 'fixed',
      effective_from: selectedYearData?.start_date || null,
      active: true,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setMessage(`${feeHeadName} added successfully.`);

    await loadData();
    setSaving(false);
  }

  async function addMissingSchoolFee(
    className: string,
    amount: number
  ) {
    await addFeeStructure('Composite Fee', amount, {
      className,
      frequency: 'Monthly',
      pricingType: 'fixed',
      applicableTo: 'all',
    });
  }

  async function addMissingHostelFee() {
    await addFeeStructure('Hostel Fee', 4000, {
      frequency: 'Monthly',
      hostelOnly: true,
      applicableTo: 'hosteller',
      pricingType: 'fixed',
    });
  }

  async function addMissingVehicleFee(
    route: string,
    area: string,
    amount: number
  ) {
    await addFeeStructure('Vehicle Fee', amount, {
      frequency: 'Monthly',
      vehicleArea: `${route} - ${area}`,
      applicableTo: 'vehicle_area',
      pricingType: 'fixed',
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          Loading fee structure...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              FEE MANAGEMENT
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Fee Structure
            </h1>

            <p className="mt-1 text-slate-500">
              Manage fees separately for every academic year.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">
              ACTIVE SESSION
            </p>

            <p className="font-bold text-slate-900">
              {years.find((y) => y.is_active)?.name || 'Not selected'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success */}
        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Academic Year */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div className="w-full lg:max-w-sm">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
              >
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.is_active ? ' — ACTIVE' : ''}
                    {year.is_locked ? ' — LOCKED' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedYearData && !selectedYearData.is_active && (
              <button
                onClick={() => activateYear(selectedYear)}
                disabled={saving || selectedYearData.is_locked}
                className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Activate {selectedYearData.name}
              </button>
            )}
          </div>
        </section>

        {/* Create New Year */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Create New Academic Year
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create the next session without changing any historical fees.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Session
              </label>

              <input
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                placeholder="2027-28"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Start Date
              </label>

              <input
                type="date"
                value={newYearStart}
                onChange={(e) => setNewYearStart(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                End Date
              </label>

              <input
                type="date"
                value={newYearEnd}
                onChange={(e) => setNewYearEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={copyPrevious}
              onChange={(e) => setCopyPrevious(e.target.checked)}
              className="h-4 w-4"
            />

            <span>
              Copy {selectedYearData?.name || 'previous'} fee structure into
              the new session
            </span>
          </label>

          <button
            onClick={createNewAcademicYear}
            disabled={saving}
            className="mt-5 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Academic Year'}
          </button>
        </section>

        {/* School Fees */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              School / Composite Fee
            </h2>

            <p className="text-sm text-slate-500">
              Monthly school fee for the selected academic year.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b text-left text-sm text-slate-500">
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Monthly Fee</th>
                  <th className="px-3 py-3">Frequency</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {CLASSES.map((className) => {
                  const row = findSchoolFee(className);

                  return (
                    <tr
                      key={className}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-4 font-semibold">
                        {className}
                      </td>

                      <td className="px-3 py-4">
                        {row ? (
                          editingId === row.id ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) =>
                                setEditAmount(e.target.value)
                              }
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2"
                            />
                          ) : (
                            <span className="font-bold">
                              ₹
                              {Number(
                                row.amount || 0
                              ).toLocaleString('en-IN')}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">
                            Not configured
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4 text-sm text-slate-500">
                        {row?.frequency || 'Monthly'}
                      </td>

                      <td className="px-3 py-4">
                        {row ? (
                          editingId === row.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveAmount(row.id)}
                                disabled={saving}
                                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Save
                              </button>

                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditAmount('');
                                }}
                                className="rounded-lg border px-3 py-2 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(row.id);
                                setEditAmount(
                                  String(row.amount ?? '')
                                );
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() =>
                              addMissingSchoolFee(
                                className,
                                ['Nursery', 'LKG', 'UKG'].includes(
                                  className
                                )
                                  ? 600
                                  : ['I', 'II', 'III', 'IV'].includes(
                                      className
                                    )
                                  ? 650
                                  : 700
                              )
                            }
                            disabled={saving}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hostel */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Hostel Fee
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Applied only to students marked as hostellers.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 p-5">
            {findHostelFee() ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-sm text-slate-500">
                    Monthly Hostel Fee
                  </p>

                  <p className="text-2xl font-bold">
                    ₹
                    {Number(
                      findHostelFee()?.amount || 0
                    ).toLocaleString('en-IN')}
                  </p>
                </div>

                {editingId === findHostelFee()?.id ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) =>
                        setEditAmount(e.target.value)
                      }
                      className="w-32 rounded-lg border px-3 py-2"
                    />

                    <button
                      onClick={() =>
                        saveAmount(findHostelFee()!.id)
                      }
                      disabled={saving}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(findHostelFee()!.id);
                      setEditAmount(
                        String(findHostelFee()?.amount ?? '')
                      );
                    }}
                    className="rounded-lg border px-4 py-2 font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={addMissingHostelFee}
                disabled={saving}
                className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Add Hostel Fee ₹4,000
              </button>
            )}
          </div>
        </section>

        {/* Vehicle */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              Vehicle / Van Fee
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Route-specific monthly fee. A student will have one selected
              route.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b text-left text-sm text-slate-500">
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3">Area</th>
                  <th className="px-3 py-3">Monthly Fee</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {ROUTES.map((route) => {
                  const row = findVehicleFee(route.area);

                  return (
                    <tr
                      key={route.route}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-4 font-semibold">
                        {route.route}
                      </td>

                      <td className="px-3 py-4">
                        {route.area}
                      </td>

                      <td className="px-3 py-4">
                        {row ? (
                          editingId === row.id ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) =>
                                setEditAmount(e.target.value)
                              }
                              className="w-32 rounded-lg border px-3 py-2"
                            />
                          ) : (
                            <span className="font-bold">
                              ₹
                              {Number(
                                row.amount || 0
                              ).toLocaleString('en-IN')}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">
                            Not configured
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4">
                        {row ? (
                          editingId === row.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveAmount(row.id)}
                                disabled={saving}
                                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Save
                              </button>

                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditAmount('');
                                }}
                                className="rounded-lg border px-3 py-2 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(row.id);
                                setEditAmount(
                                  String(row.amount ?? '')
                                );
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                            >
                              Edit
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() =>
                              addMissingVehicleFee(
                                route.route,
                                route.area,
                                route.amount
                              )
                            }
                            disabled={saving}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* One-time Fees */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            One-time / Miscellaneous Fees
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Admission, registration, books, tie & belt, festivals,
            examination and other charges will appear here.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b text-left text-sm text-slate-500">
                  <th className="px-3 py-3">Fee Head</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Pricing</th>
                  <th className="px-3 py-3">Frequency</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {oneTimeFees.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-4 font-semibold">
                      {row.fee_heads?.[0]?.name || 'Fee'}
                    </td>

                    <td className="px-3 py-4 font-bold">
                      {row.pricing_type === 'actual'
                        ? 'As per actual'
                        : `₹${Number(
                            row.amount || 0
                          ).toLocaleString('en-IN')}`}
                    </td>

                    <td className="px-3 py-4">
                      {row.pricing_type === 'actual'
                        ? 'As per actual'
                        : 'Fixed'}
                    </td>

                    <td className="px-3 py-4">
                      {row.frequency}
                    </td>

                    <td className="px-3 py-4">
                      {row.pricing_type === 'fixed' && (
                        editingId === row.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) =>
                                setEditAmount(e.target.value)
                              }
                              className="w-28 rounded-lg border px-3 py-2"
                            />

                            <button
                              onClick={() => saveAmount(row.id)}
                              disabled={saving}
                              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              Save
                            </button>

                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditAmount('');
                              }}
                              className="rounded-lg border px-3 py-2 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(row.id);
                              setEditAmount(
                                String(row.amount ?? '')
                              );
                            }}
                            className="rounded-lg border px-3 py-2 text-sm font-semibold"
                          >
                            Edit
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}

                {oneTimeFees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No one-time fee structures configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}
