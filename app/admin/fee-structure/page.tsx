'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_locked?: boolean;
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
  fee_heads?: FeeHead | null;
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
  {
    route: 'Route A',
    area: 'Mansapur',
    amount: 1000,
  },
  {
    route: 'Route B',
    area: 'Mahdeva',
    amount: 1000,
  },
  {
    route: 'Route C',
    area: 'Sonvarsha',
    amount: 800,
  },
  {
    route: 'Route D',
    area: 'Nari',
    amount: 800,
  },
  {
    route: 'Route E',
    area: 'Tharuahi',
    amount: 700,
  },
  {
    route: 'Route F',
    area: 'Tulsuyahi',
    amount: 700,
  },
  {
    route: 'Route G',
    area: 'Dhata tol',
    amount: 700,
  },
  {
    route: 'Route H',
    area: 'Harbhanga',
    amount: 600,
  },
  {
    route: 'Route I',
    area: 'Laukahi',
    amount: 500,
  },
];

export default function FeeStructurePage() {
  const sb = useMemo(
    () => supabaseBrowser(),
    []
  );

  const [years, setYears] =
    useState<AcademicYear[]>([]);

  const [heads, setHeads] =
    useState<FeeHead[]>([]);

  const [structures, setStructures] =
    useState<FeeStructure[]>([]);

  const [selectedYear, setSelectedYear] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [newYearName, setNewYearName] =
    useState('');

  const [newYearStart, setNewYearStart] =
    useState('');

  const [newYearEnd, setNewYearEnd] =
    useState('');

  const [copyPrevious, setCopyPrevious] =
    useState(true);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editAmount, setEditAmount] =
    useState('');

  const selectedYearData =
    years.find(
      (year) =>
        year.id === selectedYear
    );

  async function loadData() {
    setLoading(true);
    setError('');

    const [
      yearsResult,
      headsResult,
      structuresResult,
    ] = await Promise.all([
      sb
        .from('academic_years')
        .select('*')
        .order('start_date', {
          ascending: false,
        }),

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
        .order('created_at', {
          ascending: true,
        }),
    ]);

    if (yearsResult.error) {
      setError(
        `Academic years: ${yearsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (headsResult.error) {
      setError(
        `Fee heads: ${headsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (structuresResult.error) {
      setError(
        `Fee structures: ${structuresResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setYears(
      (yearsResult.data ||
        []) as AcademicYear[]
    );

    setHeads(
      (headsResult.data ||
        []) as FeeHead[]
    );

    /*
     * IMPORTANT:
     *
     * Supabase returns the related fee_heads
     * relationship as an array.
     *
     * Our application uses a single FeeHead
     * object, so normalize it here.
     */
    const normalizedStructures =
      (structuresResult.data || []).map(
        (structure) => ({
          ...structure,

          fee_heads:
            Array.isArray(
              structure.fee_heads
            )
              ? structure.fee_heads[0] ||
                null
              : structure.fee_heads ||
                null,
        })
      ) as unknown as FeeStructure[];

    setStructures(
      normalizedStructures
    );

    const activeYear =
      (yearsResult.data || []).find(
        (year) =>
          year.is_active
      ) ||
      (yearsResult.data || [])[0];

    if (
      activeYear &&
      !selectedYear
    ) {
      setSelectedYear(
        activeYear.id
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const yearStructures =
    structures.filter(
      (structure) =>
        structure.academic_year_id ===
        selectedYear
    );

  const schoolFees =
    yearStructures.filter(
      (structure) =>
        structure.fee_heads?.name ===
          'Composite Fee' &&
        !structure.vehicle_area &&
        !structure.hostel_only
    );

  const hostelFees =
    yearStructures.filter(
      (structure) =>
        structure.fee_heads?.name ===
        'Hostel Fee'
    );

  const vehicleFees =
    yearStructures.filter(
      (structure) =>
        structure.fee_heads?.name ===
        'Vehicle Fee'
    );

  const oneTimeFees =
    yearStructures.filter(
      (structure) =>
        structure.frequency ===
          'One-time' &&
        structure.fee_heads?.name !==
          'Composite Fee' &&
        structure.fee_heads?.name !==
          'Vehicle Fee' &&
        structure.fee_heads?.name !==
          'Hostel Fee'
    );

  function findSchoolFee(
    className: string
  ) {
    return schoolFees.find(
      (structure) =>
        structure.class_name ===
        className
    );
  }

  function findVehicleFee(
    area: string
  ) {
    return vehicleFees.find(
      (structure) => {
        const configuredArea =
          (
            structure.vehicle_area ||
            ''
          ).toLowerCase();

        return configuredArea.includes(
          area.toLowerCase()
        );
      }
    );
  }

  function findHostelFee() {
    return hostelFees[0];
  }

  async function saveAmount(
    id: string
  ) {
    const amount =
      Number(editAmount);

    if (
      Number.isNaN(amount) ||
      amount < 0
    ) {
      setError(
        'Enter a valid amount.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error } =
      await sb
        .from('fee_structures')
        .update({
          amount,
        })
        .eq('id', id);

    if (error) {
      setError(
        error.message
      );
      setSaving(false);
      return;
    }

    setEditingId(null);
    setEditAmount('');

    setMessage(
      'Fee updated successfully.'
    );

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
        (year) =>
          year.name ===
          newYearName
      )
    ) {
      setError(
        'This academic year already exists.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const {
      data: newYear,
      error: yearError,
    } = await sb
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

    if (
      yearError ||
      !newYear
    ) {
      setError(
        yearError?.message ||
          'Could not create academic year.'
      );

      setSaving(false);
      return;
    }

    if (
      copyPrevious &&
      selectedYear
    ) {
      const previousStructures =
        structures.filter(
          (structure) =>
            structure.academic_year_id ===
            selectedYear
        );

      if (
        previousStructures.length >
        0
      ) {
        const copiedRows =
          previousStructures.map(
            (structure) => ({
              academic_year_id:
                newYear.id,

              class_name:
                structure.class_name,

              fee_head_id:
                structure.fee_head_id,

              amount:
                structure.amount,

              frequency:
                structure.frequency,

              hostel_only:
                structure.hostel_only,

              vehicle_area:
                structure.vehicle_area,

              applicable_to:
                structure.applicable_to,

              pricing_type:
                structure.pricing_type,

              effective_from:
                newYearStart,

              effective_to:
                null,

              active:
                true,

              notes:
                `Copied from ${
                  selectedYearData?.name ||
                  'previous session'
                }`,
            })
          );

        const {
          error: copyError,
        } = await sb
          .from('fee_structures')
          .insert(
            copiedRows
          );

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

    const createdName =
      newYearName;

    setNewYearName('');
    setNewYearStart('');
    setNewYearEnd('');

    setSelectedYear(
      newYear.id
    );

    setMessage(
      `${createdName} created successfully${
        copyPrevious
          ? ' with previous fees copied.'
          : '.'
      }`
    );

    await loadData();

    setSaving(false);
  }

  async function activateYear(
    id: string
  ) {
    const year =
      years.find(
        (item) =>
          item.id === id
      );

    if (!year) {
      return;
    }

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

    const {
      error: deactivateError,
    } = await sb
      .from('academic_years')
      .update({
        is_active: false,
      })
      .neq('id', id);

    if (deactivateError) {
      setError(
        deactivateError.message
      );

      setSaving(false);
      return;
    }

    const {
      error: activateError,
    } = await sb
      .from('academic_years')
      .update({
        is_active: true,
      })
      .eq('id', id);

    if (activateError) {
      setError(
        activateError.message
      );

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

    const head =
      heads.find(
        (item) =>
          item.name ===
          feeHeadName
      );

    if (!head) {
      setError(
        `Fee head "${feeHeadName}" was not found.`
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const {
      error,
    } = await sb
      .from('fee_structures')
      .insert({
        academic_year_id:
          selectedYear,

        class_name:
          options.className ??
          null,

        fee_head_id:
          head.id,

        amount,

        frequency:
          options.frequency ||
          'Monthly',

        hostel_only:
          options.hostelOnly ||
          false,

        vehicle_area:
          options.vehicleArea ??
          null,

        applicable_to:
          options.applicableTo ??
          null,

        pricing_type:
          options.pricingType ||
          'fixed',

        effective_from:
          selectedYearData?.start_date ||
          null,

        active: true,
      });

    if (error) {
      setError(
        error.message
      );

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
    className: string
  ) {
    /*
     * This is only a starter value.
     * You can edit the amount immediately
     * after adding it.
     */
    await addFeeStructure(
      'Composite Fee',
      0,
      {
        className,
        frequency:
          'Monthly',
        pricingType:
          'fixed',
        applicableTo:
          'class',
      }
    );
  }

  async function addMissingHostelFee() {
    await addFeeStructure(
      'Hostel Fee',
      4000,
      {
        frequency:
          'Monthly',
        hostelOnly:
          true,
        applicableTo:
          'hosteller',
        pricingType:
          'fixed',
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
        frequency:
          'Monthly',

        vehicleArea:
          `${route} - ${area}`,

        applicableTo:
          'vehicle_area',

        pricingType:
          'fixed',
      }
    );
  }

  if (loading) {
    return (
      <main className="main">
        <div className="page-head">
          <div>
            <p
              style={{
                margin: 0,
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              FEE MANAGEMENT
            </p>

            <h1>
              Fee Structure
            </h1>

            <p className="muted">
              Loading fee structure...
            </p>
          </div>
        </div>

        <div className="card">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="main">

      <div
        style={{
          maxWidth: 1250,
          margin: '0 auto',
        }}
      >

        {/* HEADER */}

        <div className="page-head">

          <div>
            <p
              style={{
                margin: 0,
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing:
                  '0.06em',
              }}
            >
              FEE MANAGEMENT
            </p>

            <h1>
              Fee Structure
            </h1>

            <p className="muted">
              Manage fees separately for every academic year.
            </p>
          </div>

          <div className="actions">

            <a
              href="/admin/charges"
              className="btn"
              style={{
                padding:
                  '12px 18px',
                background:
                  '#2563eb',
              }}
            >
              ⚡ Generate Monthly Fees
            </a>

            <div
              className="card"
              style={{
                padding:
                  '12px 16px',
                minWidth:
                  150,
              }}
            >
              <div
                className="metric-label"
              >
                ACTIVE SESSION
              </div>

              <div
                style={{
                  fontWeight: 800,
                  marginTop: 4,
                }}
              >
                {years.find(
                  (year) =>
                    year.is_active
                )?.name ||
                  'Not selected'}
              </div>
            </div>

          </div>

        </div>

        {/* MESSAGES */}

        {error && (
          <div
            className="error"
            style={{
              marginBottom: 18,
            }}
          >
            <strong>
              Error:
            </strong>{' '}
            {error}
          </div>
        )}

        {message && (
          <div
            className="success"
            style={{
              marginBottom: 18,
            }}
          >
            {message}
          </div>
        )}

        {/* SESSION */}

        <section className="card">

          <h2>
            Academic Year
          </h2>

          <p className="muted">
            Select the session whose fee structure you want to manage.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems:
                'center',
              flexWrap:
                'wrap',
              marginTop: 16,
            }}
          >

            <select
              className="select"
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(
                  event.target.value
                )
              }
              style={{
                maxWidth: 380,
              }}
            >
              {years.map(
                (year) => (
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
                )
              )}
            </select>

            {selectedYearData &&
              !selectedYearData.is_active && (
                <button
                  type="button"
                  onClick={() =>
                    activateYear(
                      selectedYear
                    )
                  }
                  disabled={
                    saving ||
                    selectedYearData.is_locked
                  }
                  className="btn"
                >
                  Activate Session
                </button>
              )}

          </div>

        </section>

        {/* CREATE YEAR */}

        <section
          className="card"
          style={{
            marginTop: 18,
          }}
        >

          <h2>
            Create New Academic Year
          </h2>

          <p className="muted">
            Create the next session without changing historical fees.
          </p>

          <div
            className="grid2"
            style={{
              marginTop: 18,
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
              gap: 9,
              alignItems:
                'center',
              marginTop: 18,
              fontSize: 14,
              fontWeight: 600,
            }}
          >

            <input
              type="checkbox"
              checked={
                copyPrevious
              }
              onChange={(event) =>
                setCopyPrevious(
                  event.target.checked
                )
              }
            />

            Copy{' '}
            {selectedYearData?.name ||
              'previous'}{' '}
            fee structure into the new session

          </label>

          <button
            type="button"
            onClick={
              createNewAcademicYear
            }
            disabled={saving}
            className="btn"
            style={{
              marginTop: 18,
            }}
          >
            {saving
              ? 'Saving...'
              : 'Create Academic Year'}
          </button>

        </section>

        {/* SCHOOL FEE */}

        <section
          className="card"
          style={{
            marginTop: 18,
          }}
        >

          <h2>
            School / Composite Fee
          </h2>

          <p className="muted">
            Monthly school fee for the selected academic year.
          </p>

          <div
            className="table-wrap"
            style={{
              marginTop: 18,
            }}
          >

            <table className="table">

              <thead>

                <tr>
                  <th>
                    Class
                  </th>

                  <th>
                    Monthly Fee
                  </th>

                  <th>
                    Frequency
                  </th>

                  <th>
                    Action
                  </th>
                </tr>

              </thead>

              <tbody>

                {CLASSES.map(
                  (className) => {

                    const row =
                      findSchoolFee(
                        className
                      );

                    return (
                      <tr
                        key={
                          className
                        }
                      >

                        <td>
                          <strong>
                            {
                              className
                            }
                          </strong>
                        </td>

                        <td>

                          {row ? (

                            editingId ===
                            row.id ? (

                              <input
                                type="number"
                                min="0"
                                value={
                                  editAmount
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditAmount(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="input"
                                style={{
                                  maxWidth:
                                    150,
                                }}
                              />

                            ) : (

                              <strong>
                                ₹
                                {Number(
                                  row.amount ||
                                    0
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </strong>

                            )

                          ) : (

                            <span className="muted">
                              Not configured
                            </span>

                          )}

                        </td>

                        <td>
                          {row?.frequency ||
                            'Monthly'}
                        </td>

                        <td>

                          {row ? (

                            editingId ===
                            row.id ? (

                              <div className="actions">

                                <button
                                  type="button"
                                  onClick={() =>
                                    saveAmount(
                                      row.id
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                  className="btn small"
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={() => {
                                    setEditingId(
                                      null
                                    );

                                    setEditAmount(
                                      ''
                                    );
                                  }}
                                >
                                  Cancel
                                </button>

                              </div>

                            ) : (

                              <button
                                type="button"
                                className="btn secondary small"
                                onClick={() => {
                                  setEditingId(
                                    row.id
                                  );

                                  setEditAmount(
                                    String(
                                      row.amount ??
                                        ''
                                    )
                                  );
                                }}
                              >
                                Edit
                              </button>

                            )

                          ) : (

                            <button
                              type="button"
                              className="btn small"
                              disabled={
                                saving
                              }
                              onClick={() =>
                                addMissingSchoolFee(
                                  className
                                )
                              }
                            >
                              Add
                            </button>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* HOSTEL */}

        <section
          className="card"
          style={{
            marginTop: 18,
          }}
        >

          <h2>
            Hostel Fee
          </h2>

          <p className="muted">
            Applied only to students marked as hostellers.
          </p>

          <div
            style={{
              marginTop: 18,
            }}
          >

            {findHostelFee() ? (

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  gap: 15,
                  flexWrap:
                    'wrap',
                  padding: 18,
                  border:
                    '1px solid #e7ebf2',
                  borderRadius:
                    14,
                }}
              >

                <div>

                  <div className="metric-label">
                    Monthly Hostel Fee
                  </div>

                  {editingId ===
                  findHostelFee()?.id ? (

                    <input
                      type="number"
                      min="0"
                      value={
                        editAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setEditAmount(
                          event.target
                            .value
                        )
                      }
                      className="input"
                      style={{
                        marginTop: 8,
                        maxWidth:
                          180,
                      }}
                    />

                  ) : (

                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        marginTop: 5,
                      }}
                    >
                      ₹
                      {Number(
                        findHostelFee()
                          ?.amount ||
                          0
                      ).toLocaleString(
                        'en-IN'
                      )}
                    </div>

                  )}

                </div>

                {editingId ===
                findHostelFee()?.id ? (

                  <div className="actions">

                    <button
                      type="button"
                      className="btn small"
                      onClick={() =>
                        saveAmount(
                          findHostelFee()!
                            .id
                        )
                      }
                      disabled={
                        saving
                      }
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => {
                        setEditingId(
                          null
                        );

                        setEditAmount(
                          ''
                        );
                      }}
                    >
                      Cancel
                    </button>

                  </div>

                ) : (

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditingId(
                        findHostelFee()!
                          .id
                      );

                      setEditAmount(
                        String(
                          findHostelFee()
                            ?.amount ??
                            ''
                        )
                      );
                    }}
                  >
                    Edit
                  </button>

                )}

              </div>

            ) : (

              <button
                type="button"
                className="btn"
                disabled={
                  saving
                }
                onClick={
                  addMissingHostelFee
                }
              >
                Add Hostel Fee ₹4,000
              </button>

            )}

          </div>

        </section>

        {/* VEHICLE */}

        <section
          className="card"
          style={{
            marginTop: 18,
          }}
        >

          <h2>
            Vehicle / Van Fee
          </h2>

          <p className="muted">
            Route-specific monthly fee. Students are matched using their vehicle area.
          </p>

          <div
            className="table-wrap"
            style={{
              marginTop: 18,
            }}
          >

            <table className="table">

              <thead>

                <tr>

                  <th>
                    Route
                  </th>

                  <th>
                    Area
                  </th>

                  <th>
                    Monthly Fee
                  </th>

                  <th>
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {ROUTES.map(
                  (route) => {

                    const row =
                      findVehicleFee(
                        route.area
                      );

                    return (
                      <tr
                        key={
                          route.route
                        }
                      >

                        <td>
                          <strong>
                            {
                              route.route
                            }
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
                                type="number"
                                min="0"
                                value={
                                  editAmount
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditAmount(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="input"
                                style={{
                                  maxWidth:
                                    150,
                                }}
                              />

                            ) : (

                              <strong>
                                ₹
                                {Number(
                                  row.amount ||
                                    0
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </strong>

                            )

                          ) : (

                            <span className="muted">
                              Not configured
                            </span>

                          )}

                        </td>

                        <td>

                          {row ? (

                            editingId ===
                            row.id ? (

                              <div className="actions">

                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() =>
                                    saveAmount(
                                      row.id
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={() => {
                                    setEditingId(
                                      null
                                    );

                                    setEditAmount(
                                      ''
                                    );
                                  }}
                                >
                                  Cancel
                                </button>

                              </div>

                            ) : (

                              <button
                                type="button"
                                className="btn secondary small"
                                onClick={() => {
                                  setEditingId(
                                    row.id
                                  );

                                  setEditAmount(
                                    String(
                                      row.amount ??
                                        ''
                                    )
                                  );
                                }}
                              >
                                Edit
                              </button>

                            )

                          ) : (

                            <button
                              type="button"
                              className="btn small"
                              disabled={
                                saving
                              }
                              onClick={() =>
                                addMissingVehicleFee(
                                  route.route,
                                  route.area,
                                  route.amount
                                )
                              }
                            >
                              Add
                            </button>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ONE TIME FEES */}

        <section
          className="card"
          style={{
            marginTop: 18,
            marginBottom: 30,
          }}
        >

          <h2>
            One-time / Miscellaneous Fees
          </h2>

          <p className="muted">
            Admission, books, tie &amp; belt, festivals,
            examination and other charges.
          </p>

          <div
            className="table-wrap"
            style={{
              marginTop: 18,
            }}
          >

            <table className="table">

              <thead>

                <tr>

                  <th>
                    Fee Head
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Pricing
                  </th>

                  <th>
                    Frequency
                  </th>

                  <th>
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {oneTimeFees.map(
                  (row) => (

                    <tr
                      key={
                        row.id
                      }
                    >

                      <td>
                        <strong>
                          {row.fee_heads
                            ?.name ||
                            'Fee'}
                        </strong>
                      </td>

                      <td>

                        {row.pricing_type ===
                        'actual'
                          ? 'As per actual'
                          : `₹${Number(
                              row.amount ||
                                0
                            ).toLocaleString(
                              'en-IN'
                            )}`}

                      </td>

                      <td>
                        {row.pricing_type ===
                        'actual'
                          ? 'Actual'
                          : 'Fixed'}
                      </td>

                      <td>
                        {
                          row.frequency
                        }
                      </td>

                      <td>

                        {row.pricing_type !==
                          'actual' && (

                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => {
                              setEditingId(
                                row.id
                              );

                              setEditAmount(
                                String(
                                  row.amount ??
                                    ''
                                )
                              );
                            }}
                          >
                            Edit
                          </button>

                        )}

                      </td>

                    </tr>

                  )
                )}

                {oneTimeFees.length ===
                  0 && (

                  <tr>

                    <td
                      colSpan={5}
                      className="empty"
                    >
                      No one-time fee
                      structures configured
                      yet.
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
