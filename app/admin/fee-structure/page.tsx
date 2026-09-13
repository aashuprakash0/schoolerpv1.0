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

  const selectedYearData = years.find(
    (year) => year.id === selectedYear
  );

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

    setStructures(
      (structuresResult.data || []) as unknown as FeeStructure[]
    );

    const activeYear =
      (yearsResult.data || []).find((year) => year.is_active) ||
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
    (structure) =>
      structure.academic_year_id === selectedYear
  );

  const schoolFees = yearStructures.filter(
    (structure) =>
      structure.fee_heads?.[0]?.name === 'Composite Fee' &&
      !structure.vehicle_area &&
      !structure.hostel_only
  );

  const hostelFees = yearStructures.filter(
    (structure) =>
      structure.fee_heads?.[0]?.name === 'Hostel Fee'
  );

  const vehicleFees = yearStructures.filter(
    (structure) =>
      structure.fee_heads?.[0]?.name === 'Vehicle Fee'
  );

  const oneTimeFees = yearStructures.filter(
    (structure) =>
      structure.frequency === 'One-time' &&
      structure.fee_heads?.[0]?.name !== 'Composite Fee' &&
      structure.fee_heads?.[0]?.name !== 'Vehicle Fee' &&
      structure.fee_heads?.[0]?.name !== 'Hostel Fee'
  );

  function findSchoolFee(className: string) {
    return schoolFees.find(
      (structure) => structure.class_name === className
    );
  }

  function findVehicleFee(area: string) {
    return vehicleFees.find((structure) =>
      structure.vehicle_area
        ?.toLowerCase()
        .includes(area.toLowerCase())
    );
  }

  function findHostelFee() {
    return hostelFees[0];
  }

  function clearMessages() {
    setError('');
    setMessage('');
  }

  async function saveAmount(id: string) {
    const amount = Number(editAmount);

    if (Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid amount.');
      return;
    }

    setSaving(true);
    clearMessages();

    const { error: updateError } = await sb
      .from('fee_structures')
      .update({
        amount,
      })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
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
    if (
      !newYearName ||
      !newYearStart ||
      !newYearEnd
    ) {
      setError(
        'Enter session name, start date and end date.'
      );
      return;
    }

    if (
      years.some(
        (year) => year.name === newYearName
      )
    ) {
      setError('This academic year already exists.');
      return;
    }

    setSaving(true);
    clearMessages();

    const { data: newYear, error: yearError } =
      await sb
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
      setError(
        yearError?.message ||
          'Could not create academic year.'
      );

      setSaving(false);
      return;
    }

    if (copyPrevious && selectedYear) {
      const previousStructures =
        structures.filter(
          (structure) =>
            structure.academic_year_id ===
            selectedYear
        );

      if (previousStructures.length > 0) {
        const copiedRows =
          previousStructures.map((structure) => ({
            academic_year_id: newYear.id,
            class_name: structure.class_name,
            fee_head_id: structure.fee_head_id,
            amount: structure.amount,
            frequency: structure.frequency,
            hostel_only: structure.hostel_only,
            vehicle_area: structure.vehicle_area,
            applicable_to: structure.applicable_to,
            pricing_type: structure.pricing_type,
            effective_from: newYearStart,
            effective_to: null,
            active: true,
            notes: `Copied from ${
              selectedYearData?.name ||
              'previous session'
            }`,
          }));

        const { error: copyError } =
          await sb
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
        copyPrevious
          ? ' with previous fees copied.'
          : '.'
      }`
    );

    setSelectedYear(newYear.id);

    await loadData();

    setSaving(false);
  }

  async function activateYear(id: string) {
    const year = years.find(
      (item) => item.id === id
    );

    if (!year) return;

    const confirmed = window.confirm(
      `Activate ${year.name}?\n\nThis will make ${year.name} the current academic year.`
    );

    if (!confirmed) return;

    setSaving(true);
    clearMessages();

    const { error: deactivateError } =
      await sb
        .from('academic_years')
        .update({ is_active: false })
        .neq('id', id);

    if (deactivateError) {
      setError(deactivateError.message);
      setSaving(false);
      return;
    }

    const { error: activateError } =
      await sb
        .from('academic_years')
        .update({ is_active: true })
        .eq('id', id);

    if (activateError) {
      setError(activateError.message);
      setSaving(false);
      return;
    }

    setMessage(
      `${year.name} is now the active academic year.`
    );

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
      setError(
        'Select an academic year first.'
      );
      return;
    }

    const head = heads.find(
      (item) => item.name === feeHeadName
    );

    if (!head) {
      setError(
        `Fee head "${feeHeadName}" was not found.`
      );
      return;
    }

    setSaving(true);
    clearMessages();

    const { error: insertError } =
      await sb
        .from('fee_structures')
        .insert({
          academic_year_id: selectedYear,
          class_name:
            options.className ?? null,
          fee_head_id: head.id,
          amount,
          frequency:
            options.frequency || 'Monthly',
          hostel_only:
            options.hostelOnly || false,
          vehicle_area:
            options.vehicleArea ?? null,
          applicable_to:
            options.applicableTo ?? null,
          pricing_type:
            options.pricingType || 'fixed',
          effective_from:
            selectedYearData?.start_date ||
            null,
          active: true,
        });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setMessage(
      `${feeHeadName} added successfully.`
    );

    await loadData();

    setSaving(false);
  }

  async function addMissingSchoolFee(
    className: string,
    amount: number
  ) {
    await addFeeStructure(
      'Composite Fee',
      amount,
      {
        className,
        frequency: 'Monthly',
        pricingType: 'fixed',
        applicableTo: 'all',
      }
    );
  }

  async function addMissingHostelFee() {
    await addFeeStructure(
      'Hostel Fee',
      4000,
      {
        frequency: 'Monthly',
        hostelOnly: true,
        applicableTo: 'hosteller',
        pricingType: 'fixed',
      }
    );
  }

  async function addMissingVehicleFee(
    route: string,
    area: string,
    amount: number
  ) {
    await addFeeStructure(
      'Vehicle Fee',
      amount,
      {
        frequency: 'Monthly',
        vehicleArea: `${route} - ${area}`,
        applicableTo: 'vehicle_area',
        pricingType: 'fixed',
      }
    );
  }

  function startEditing(
    structure: FeeStructure
  ) {
    setEditingId(structure.id);
    setEditAmount(
      String(structure.amount ?? '')
    );
    clearMessages();
  }

  function cancelEditing() {
    setEditingId(null);
    setEditAmount('');
  }

  if (loading) {
    return (
      <main className="main">
        <div className="page-head">
          <div>
            <p className="muted">
              FEE MANAGEMENT
            </p>

            <h1>Fee Structure</h1>

            <p className="muted">
              Loading fee structure...
            </p>
          </div>
        </div>

        <div className="card">
          Loading fee structure...
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="fee-page">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="page-head">
          <div>
            <p
              style={{
                margin: 0,
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              FEE MANAGEMENT
            </p>

            <h1>Fee Structure</h1>

            <p className="muted">
              Manage fees separately for every
              academic year.
            </p>
          </div>

          <div className="fee-active-session">
            <div className="fee-active-session-label">
              ACTIVE SESSION
            </div>

            <div className="fee-active-session-value">
              {years.find(
                (year) => year.is_active
              )?.name || 'Not selected'}
            </div>
          </div>
        </div>

        {/* =====================================================
            ALERTS
        ====================================================== */}

        {error && (
          <div className="error" style={{ marginBottom: 16 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {message && (
          <div
            className="success"
            style={{ marginBottom: 16 }}
          >
            {message}
          </div>
        )}

        {/* =====================================================
            ACADEMIC YEAR
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>Academic Year</h2>

            <p>
              Select the session whose fee structure
              you want to manage.
            </p>
          </div>

          <div className="fee-session-card">

            <div style={{ width: '100%', maxWidth: 420 }}>
              <label className="label">
                Academic Year

                <select
                  className="select"
                  value={selectedYear}
                  onChange={(event) =>
                    setSelectedYear(
                      event.target.value
                    )
                  }
                >
                  {years.map((year) => (
                    <option
                      key={year.id}
                      value={year.id}
                    >
                      {year.name}
                      {year.is_active
                        ? ' — ACTIVE'
                        : ''}
                      {year.is_locked
                        ? ' — LOCKED'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedYearData &&
              !selectedYearData.is_active && (
                <button
                  className="btn"
                  onClick={() =>
                    activateYear(selectedYear)
                  }
                  disabled={
                    saving ||
                    selectedYearData.is_locked
                  }
                >
                  Activate{' '}
                  {selectedYearData.name}
                </button>
              )}
          </div>
        </section>

        {/* =====================================================
            CREATE NEW ACADEMIC YEAR
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>
              Create New Academic Year
            </h2>

            <p>
              Create the next session without
              changing historical fees.
            </p>
          </div>

          <div
            className="grid2"
            style={{
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
            }}
          >
            <label className="label">
              Session

              <input
                className="input"
                value={newYearName}
                onChange={(event) =>
                  setNewYearName(
                    event.target.value
                  )
                }
                placeholder="2027-28"
              />
            </label>

            <label className="label">
              Start Date

              <input
                className="input"
                type="date"
                value={newYearStart}
                onChange={(event) =>
                  setNewYearStart(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="label">
              End Date

              <input
                className="input"
                type="date"
                value={newYearEnd}
                onChange={(event) =>
                  setNewYearEnd(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 20,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={copyPrevious}
              onChange={(event) =>
                setCopyPrevious(
                  event.target.checked
                )
              }
            />

            <span>
              Copy{' '}
              <strong>
                {selectedYearData?.name ||
                  'previous'}
              </strong>{' '}
              fee structure into the new
              session
            </span>
          </label>

          <div style={{ marginTop: 20 }}>
            <button
              className="btn"
              onClick={
                createNewAcademicYear
              }
              disabled={saving}
            >
              {saving
                ? 'Creating...'
                : 'Create Academic Year'}
            </button>
          </div>
        </section>

        {/* =====================================================
            SCHOOL / COMPOSITE FEE
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>
              🏫 School / Composite Fee
            </h2>

            <p>
              Monthly school fee for the
              selected academic year.
            </p>
          </div>

          <div className="fee-table-wrap">
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Monthly Fee</th>
                  <th>Frequency</th>
                  <th>Applicable To</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {CLASSES.map((className) => {
                  const row =
                    findSchoolFee(className);

                  return (
                    <tr key={className}>
                      <td>
                        <strong>
                          {className}
                        </strong>
                      </td>

                      <td>
                        {row ? (
                          editingId ===
                          row.id ? (
                            <input
                              className="fee-number"
                              type="number"
                              min="0"
                              value={editAmount}
                              onChange={(event) =>
                                setEditAmount(
                                  event.target
                                    .value
                                )
                              }
                            />
                          ) : (
                            <span className="fee-amount">
                              ₹
                              {Number(
                                row.amount || 0
                              ).toLocaleString(
                                'en-IN'
                              )}
                            </span>
                          )
                        ) : (
                          <span className="fee-not-configured">
                            Not configured
                          </span>
                        )}
                      </td>

                      <td>
                        <span className="badge">
                          {row?.frequency ||
                            'Monthly'}
                        </span>
                      </td>

                      <td>
                        <span className="badge green">
                          {row?.applicable_to ||
                            'all'}
                        </span>
                      </td>

                      <td>
                        {row ? (
                          editingId ===
                          row.id ? (
                            <div className="fee-action-group">
                              <button
                                className="btn small"
                                onClick={() =>
                                  saveAmount(
                                    row.id
                                  )
                                }
                                disabled={saving}
                              >
                                Save
                              </button>

                              <button
                                className="btn secondary small"
                                onClick={
                                  cancelEditing
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="fee-edit"
                              onClick={() =>
                                startEditing(row)
                              }
                            >
                              Edit
                            </button>
                          )
                        ) : (
                          <button
                            className="fee-add"
                            onClick={() =>
                              addMissingSchoolFee(
                                className,
                                [
                                  'Nursery',
                                  'LKG',
                                  'UKG',
                                ].includes(
                                  className
                                )
                                  ? 600
                                  : [
                                        'I',
                                        'II',
                                        'III',
                                        'IV',
                                      ].includes(
                                        className
                                      )
                                    ? 650
                                    : 700
                              )
                            }
                            disabled={saving}
                          >
                            + Add
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

        {/* =====================================================
            HOSTEL FEE
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>🏠 Hostel Fee</h2>

            <p>
              Applied only to students marked
              as hostellers.
            </p>
          </div>

          <div className="card">
            {findHostelFee() ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div className="metric-label">
                    Monthly Hostel Fee
                  </div>

                  {editingId ===
                  findHostelFee()?.id ? (
                    <input
                      className="fee-number"
                      type="number"
                      min="0"
                      value={editAmount}
                      onChange={(event) =>
                        setEditAmount(
                          event.target.value
                        )
                      }
                    />
                  ) : (
                    <div
                      className="metric"
                      style={{
                        fontSize: 26,
                      }}
                    >
                      ₹
                      {Number(
                        findHostelFee()
                          ?.amount || 0
                      ).toLocaleString(
                        'en-IN'
                      )}
                    </div>
                  )}
                </div>

                {editingId ===
                findHostelFee()?.id ? (
                  <div className="fee-action-group">
                    <button
                      className="btn"
                      onClick={() =>
                        saveAmount(
                          findHostelFee()!.id
                        )
                      }
                      disabled={saving}
                    >
                      Save
                    </button>

                    <button
                      className="btn secondary"
                      onClick={
                        cancelEditing
                      }
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="fee-edit"
                    onClick={() =>
                      startEditing(
                        findHostelFee()!
                      )
                    }
                  >
                    Edit Fee
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>
                    Hostel fee is not configured
                  </strong>

                  <p className="muted">
                    Default setup: ₹4,000/month
                  </p>
                </div>

                <button
                  className="btn"
                  onClick={
                    addMissingHostelFee
                  }
                  disabled={saving}
                >
                  + Add Hostel Fee ₹4,000
                </button>
              </div>
            )}
          </div>
        </section>

        {/* =====================================================
            VEHICLE / VAN
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>🚌 Vehicle / Van Fee</h2>

            <p>
              Route-specific monthly fee.
              Each student can have one
              selected vehicle route.
            </p>
          </div>

          <div className="fee-table-wrap">
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Area</th>
                  <th>Monthly Fee</th>
                  <th>Pricing</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {ROUTES.map((route) => {
                  const row =
                    findVehicleFee(
                      route.area
                    );

                  return (
                    <tr key={route.route}>
                      <td>
                        <strong>
                          {route.route}
                        </strong>
                      </td>

                      <td>
                        {route.area}
                      </td>

                      <td>
                        {row ? (
                          editingId ===
                          row.id ? (
                            <input
                              className="fee-number"
                              type="number"
                              min="0"
                              value={editAmount}
                              onChange={(event) =>
                                setEditAmount(
                                  event.target
                                    .value
                                )
                              }
                            />
                          ) : (
                            <span className="fee-amount">
                              ₹
                              {Number(
                                row.amount || 0
                              ).toLocaleString(
                                'en-IN'
                              )}
                            </span>
                          )
                        ) : (
                          <span className="fee-not-configured">
                            Not configured
                          </span>
                        )}
                      </td>

                      <td>
                        {row ? (
                          row.pricing_type ===
                          'actual' ? (
                            <span className="badge amber">
                              As per actual
                            </span>
                          ) : (
                            <span className="badge">
                              Fixed
                            </span>
                          )
                        ) : (
                          <span className="badge">
                            Fixed
                          </span>
                        )}
                      </td>

                      <td>
                        {row ? (
                          editingId ===
                          row.id ? (
                            <div className="fee-action-group">
                              <button
                                className="btn small"
                                onClick={() =>
                                  saveAmount(
                                    row.id
                                  )
                                }
                                disabled={saving}
                              >
                                Save
                              </button>

                              <button
                                className="btn secondary small"
                                onClick={
                                  cancelEditing
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="fee-edit"
                              onClick={() =>
                                startEditing(row)
                              }
                            >
                              Edit
                            </button>
                          )
                        ) : (
                          <button
                            className="fee-add"
                            onClick={() =>
                              addMissingVehicleFee(
                                route.route,
                                route.area,
                                route.amount
                              )
                            }
                            disabled={saving}
                          >
                            + Add
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

        {/* =====================================================
            ONE TIME / MISCELLANEOUS
        ====================================================== */}

        <section className="fee-section">
          <div className="fee-section-header">
            <h2>
              📚 One-time / Miscellaneous Fees
            </h2>

            <p>
              Admission, registration, books,
              tie &amp; belt, festivals,
              examination and other special
              charges.
            </p>
          </div>

          <div className="fee-table-wrap">
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Fee Head</th>
                  <th>Amount</th>
                  <th>Pricing</th>
                  <th>Frequency</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {oneTimeFees.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {row.fee_heads?.[0]
                          ?.name ||
                          'Fee'}
                      </strong>
                    </td>

                    <td>
                      {row.pricing_type ===
                      'actual' ? (
                        <span className="badge amber">
                          As per actual
                        </span>
                      ) : (
                        <span className="fee-amount">
                          ₹
                          {Number(
                            row.amount || 0
                          ).toLocaleString(
                            'en-IN'
                          )}
                        </span>
                      )}
                    </td>

                    <td>
                      {row.pricing_type ===
                      'actual' ? (
                        <span className="badge amber">
                          Actual
                        </span>
                      ) : (
                        <span className="badge">
                          Fixed
                        </span>
                      )}
                    </td>

                    <td>
                      <span className="badge">
                        {row.frequency}
                      </span>
                    </td>

                    <td>
                      {row.pricing_type ===
                        'fixed' &&
                        (editingId ===
                        row.id ? (
                          <div className="fee-action-group">
                            <input
                              className="fee-number"
                              type="number"
                              min="0"
                              value={editAmount}
                              onChange={(event) =>
                                setEditAmount(
                                  event.target
                                    .value
                                )
                              }
                            />

                            <button
                              className="btn small"
                              onClick={() =>
                                saveAmount(
                                  row.id
                                )
                              }
                              disabled={saving}
                            >
                              Save
                            </button>

                            <button
                              className="btn secondary small"
                              onClick={
                                cancelEditing
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="fee-edit"
                            onClick={() =>
                              startEditing(row)
                            }
                          >
                            Edit
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}

                {oneTimeFees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: 'center',
                        padding: 40,
                      }}
                    >
                      <div className="empty">
                        <strong>
                          No one-time fees
                          configured yet.
                        </strong>

                        <p>
                          Special charges such
                          as admission, books,
                          tie &amp; belt,
                          Republic Day,
                          Independence Day
                          and Saraswati Puja
                          can be added here.
                        </p>
                      </div>
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
