'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type Student = {
  id: string;
  admission_no: string;
  name: string;
  class_name: string;
  section: string;
  hostel_required: boolean;
  vehicle_required: boolean;
  vehicle_area: string | null;
  student_status: string;
};

type FeeStructure = {
  id: string;
  academic_year_id: string;
  class_name: string | null;
  fee_head_id: string | null;
  amount: number | null;
  frequency: string;
  hostel_only: boolean;
  vehicle_area: string | null;
  applicable_to: string | null;
  pricing_type: string;
  active: boolean;
  fee_heads?: {
    id: string;
    name: string;
    category: string | null;
    is_recurring: boolean | null;
  } | {
    id: string;
    name: string;
    category: string | null;
    is_recurring: boolean | null;
  }[] | null;
};

type ExistingCharge = {
  student_id: string;
  academic_year_id: string | null;
  fee_head_id: string | null;
  charge_type: string;
  period_month: string | null;
};

const MONTHS = [
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
];

function getFeeHead(
  structure: FeeStructure
) {
  if (!structure.fee_heads) {
    return null;
  }

  if (Array.isArray(structure.fee_heads)) {
    return structure.fee_heads[0] || null;
  }

  return structure.fee_heads;
}

function normalise(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isSchoolStructure(
  structure: FeeStructure
) {
  const head = getFeeHead(structure);
  const name = normalise(head?.name);
  const category = normalise(head?.category);

  return (
    category === 'school' ||
    name === 'school fee' ||
    name === 'composite fee'
  );
}

function isHostelStructure(
  structure: FeeStructure
) {
  const head = getFeeHead(structure);
  const name = normalise(head?.name);
  const category = normalise(head?.category);

  return (
    category === 'hostel' ||
    name === 'hostel fee' ||
    structure.hostel_only === true ||
    structure.applicable_to === 'hosteller'
  );
}

function isVehicleStructure(
  structure: FeeStructure
) {
  const head = getFeeHead(structure);
  const name = normalise(head?.name);
  const category = normalise(head?.category);

  return (
    category === 'vehicle' ||
    name === 'vehicle fee' ||
    Boolean(structure.vehicle_area)
  );
}

export default function ChargesPage() {
  const sb = useMemo(
    () => supabaseBrowser(),
    []
  );

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [structures, setStructures] = useState<
    FeeStructure[]
  >([]);
  const [existingCharges, setExistingCharges] =
    useState<ExistingCharge[]>([]);

  const [selectedYear, setSelectedYear] =
    useState('');

  const [selectedMonth, setSelectedMonth] =
    useState('09');

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    noSchoolFee: number;
    noVehicleFee: number;
    actualVehicle: number;
    hostelAdded: number;
    vehicleAdded: number;
    schoolAdded: number;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');

    const [
      yearsResult,
      studentsResult,
      structuresResult,
      chargesResult,
    ] = await Promise.all([
      sb
        .from('academic_years')
        .select(
          'id,name,start_date,end_date,is_active'
        )
        .order('start_date', {
          ascending: false,
        }),

      sb
        .from('students')
        .select(`
          id,
          admission_no,
          name,
          class_name,
          section,
          hostel_required,
          vehicle_required,
          vehicle_area,
          student_status
        `)
        .eq('student_status', 'active')
        .order('admission_no'),

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
          active,
          fee_heads (
            id,
            name,
            category,
            is_recurring
          )
        `)
        .eq('active', true),

      sb
        .from('student_charges')
        .select(`
          student_id,
          academic_year_id,
          fee_head_id,
          charge_type,
          period_month
        `)
        .eq('charge_type', 'monthly'),
    ]);

    if (yearsResult.error) {
      setError(
        `Academic years: ${yearsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (studentsResult.error) {
      setError(
        `Students: ${studentsResult.error.message}`
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

    if (chargesResult.error) {
      setError(
        `Student charges: ${chargesResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setYears(yearsResult.data || []);
    setStudents(studentsResult.data || []);

    setStructures(
      (structuresResult.data ||
        []) as unknown as FeeStructure[]
    );

    setExistingCharges(
      chargesResult.data || []
    );

    const activeYear =
      (yearsResult.data || []).find(
        (year) => year.is_active
      ) ||
      (yearsResult.data || [])[0];

    if (activeYear) {
      setSelectedYear(
        activeYear.id
      );

      /*
       * Default month based on current date
       * if it belongs to the selected session.
       */
      const currentMonth =
        String(
          new Date().getMonth() + 1
        ).padStart(2, '0');

      setSelectedMonth(
        MONTHS.some(
          (month) =>
            month.value === currentMonth
        )
          ? currentMonth
          : '04'
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedYearData =
    years.find(
      (year) =>
        year.id === selectedYear
    );

  const yearStructures =
    structures.filter(
      (structure) =>
        structure.academic_year_id ===
        selectedYear
    );

  const schoolStructures =
    yearStructures.filter(
      isSchoolStructure
    );

  const hostelStructures =
    yearStructures.filter(
      isHostelStructure
    );

  const vehicleStructures =
    yearStructures.filter(
      isVehicleStructure
    );

  const schoolConfiguredClasses =
    new Set(
      schoolStructures
        .filter(
          (structure) =>
            structure.frequency ===
              'Monthly' ||
            structure.frequency ===
              'monthly'
        )
        .map((structure) =>
          normalise(
            structure.class_name
          )
        )
        .filter(Boolean)
    );

  function findSchoolFee(
    className: string
  ) {
    return schoolStructures.find(
      (structure) =>
        normalise(
          structure.class_name
        ) === normalise(className) &&
        (
          structure.frequency ===
            'Monthly' ||
          structure.frequency ===
            'monthly'
        )
    );
  }

  function findHostelFee() {
    return hostelStructures.find(
      (structure) =>
        structure.frequency ===
          'Monthly' ||
        structure.frequency ===
          'monthly'
    );
  }

  function findVehicleFee(
    student: Student
  ) {
    if (
      !student.vehicle_required ||
      !student.vehicle_area
    ) {
      return null;
    }

    const studentArea =
      normalise(
        student.vehicle_area
      );

    /*
     * Exact / contains matching.
     *
     * Examples:
     * "Route A - Mansapur"
     * "Mansapur"
     */
    return (
      vehicleStructures.find(
        (structure) => {
          const routeArea =
            normalise(
              structure.vehicle_area
            );

          if (!routeArea) {
            return false;
          }

          return (
            routeArea ===
              studentArea ||
            routeArea.includes(
              studentArea
            ) ||
            studentArea.includes(
              routeArea
            )
          );
        }
      ) || null
    );
  }

  function alreadyGenerated(
    studentId: string,
    feeHeadId: string | null,
    monthDate: string
  ) {
    return existingCharges.some(
      (charge) =>
        charge.student_id ===
          studentId &&
        charge.academic_year_id ===
          selectedYear &&
        charge.fee_head_id ===
          feeHeadId &&
        charge.charge_type ===
          'monthly' &&
        charge.period_month ===
          monthDate
    );
  }

  async function generateMonthlyFees() {
    if (!selectedYearData) {
      setError(
        'Select an academic year first.'
      );
      return;
    }

    if (students.length === 0) {
      setError(
        'No active students found.'
      );
      return;
    }

    setGenerating(true);
    setError('');
    setMessage('');
    setResult(null);

    /*
     * Academic-year month.
     *
     * 2026-27:
     * April 2026 → 2026-04-01
     * ...
     * December 2026 → 2026-12-01
     * January 2027 → 2027-01-01
     */
    const startYear =
      selectedYearData.start_date
        ? Number(
            selectedYearData.start_date.slice(
              0,
              4
            )
          )
        : new Date().getFullYear();

    const monthNumber =
      Number(selectedMonth);

    const chargeYear =
      monthNumber >= 4
        ? startYear
        : startYear + 1;

    const periodMonth =
      `${chargeYear}-${selectedMonth}-01`;

    const dueDate =
      periodMonth;

    const rows: Array<{
      student_id: string;
      academic_year_id: string;
      fee_head_id: string;
      charge_name: string;
      charge_type: string;
      period_month: string;
      due_date: string;
      amount: number;
      notes: string;
    }> = [];

    let skipped = 0;
    let noSchoolFee = 0;
    let noVehicleFee = 0;
    let actualVehicle = 0;

    let schoolAdded = 0;
    let hostelAdded = 0;
    let vehicleAdded = 0;

    for (const student of students) {
      /*
       * SCHOOL FEE
       */
      const schoolFee =
        findSchoolFee(
          student.class_name
        );

      if (!schoolFee) {
        noSchoolFee++;
      } else if (
        schoolFee.fee_head_id &&
        schoolFee.amount !== null &&
        !alreadyGenerated(
          student.id,
          schoolFee.fee_head_id,
          periodMonth
        )
      ) {
        rows.push({
          student_id:
            student.id,

          academic_year_id:
            selectedYear,

          fee_head_id:
            schoolFee.fee_head_id,

          charge_name:
            `School Fee — ${student.class_name}`,

          charge_type:
            'monthly',

          period_month:
            periodMonth,

          due_date:
            dueDate,

          amount:
            Number(
              schoolFee.amount
            ),

          notes:
            `Automatically generated from ${selectedYearData.name} fee structure.`,
        });

        schoolAdded++;
      } else {
        skipped++;
      }

      /*
       * HOSTEL FEE
       */
      if (student.hostel_required) {
        const hostelFee =
          findHostelFee();

        if (
          hostelFee &&
          hostelFee.fee_head_id &&
          hostelFee.amount !== null
        ) {
          if (
            !alreadyGenerated(
              student.id,
              hostelFee.fee_head_id,
              periodMonth
            )
          ) {
            rows.push({
              student_id:
                student.id,

              academic_year_id:
                selectedYear,

              fee_head_id:
                hostelFee.fee_head_id,

              charge_name:
                'Hostel Fee',

              charge_type:
                'monthly',

              period_month:
                periodMonth,

              due_date:
                dueDate,

              amount:
                Number(
                  hostelFee.amount
                ),

              notes:
                'Automatically generated because student is marked as hosteller.',
            });

            hostelAdded++;
          } else {
            skipped++;
          }
        }
      }

      /*
       * VEHICLE FEE
       */
      if (
        student.vehicle_required
      ) {
        const vehicleFee =
          findVehicleFee(
            student
          );

        if (!vehicleFee) {
          noVehicleFee++;
        } else if (
          vehicleFee.pricing_type ===
          'actual'
        ) {
          /*
           * Actual vehicle charges need
           * an actual amount before a
           * charge can be created.
           */
          actualVehicle++;
        } else if (
          vehicleFee.fee_head_id &&
          vehicleFee.amount !== null
        ) {
          if (
            !alreadyGenerated(
              student.id,
              vehicleFee.fee_head_id,
              periodMonth
            )
          ) {
            rows.push({
              student_id:
                student.id,

              academic_year_id:
                selectedYear,

              fee_head_id:
                vehicleFee.fee_head_id,

              charge_name:
                `Vehicle Fee — ${
                  student.vehicle_area ||
                  vehicleFee.vehicle_area ||
                  'Route'
                }`,

              charge_type:
                'monthly',

              period_month:
                periodMonth,

              due_date:
                dueDate,

              amount:
                Number(
                  vehicleFee.amount
                ),

              notes:
                'Automatically generated from vehicle route fee structure.',
            });

            vehicleAdded++;
          } else {
            skipped++;
          }
        }
      }
    }

    if (rows.length === 0) {
      setResult({
        created: 0,
        skipped,
        noSchoolFee,
        noVehicleFee,
        actualVehicle,
        hostelAdded,
        vehicleAdded,
        schoolAdded,
      });

      setMessage(
        'No new monthly charges were created. Existing charges may already be generated or fee structure is incomplete.'
      );

      setGenerating(false);
      return;
    }

    /*
     * Insert in batches.
     *
     * This avoids sending a huge request if
     * the school has hundreds of students.
     */
    const batchSize = 500;
    let created = 0;

    for (
      let i = 0;
      i < rows.length;
      i += batchSize
    ) {
      const batch =
        rows.slice(
          i,
          i + batchSize
        );

      const {
        error: insertError,
      } = await sb
        .from('student_charges')
        .insert(batch);

      if (insertError) {
        setError(
          `Monthly fee generation stopped after ${created} charges: ${insertError.message}`
        );

        setGenerating(false);
        return;
      }

      created += batch.length;
    }

    setResult({
      created,
      skipped,
      noSchoolFee,
      noVehicleFee,
      actualVehicle,
      hostelAdded,
      vehicleAdded,
      schoolAdded,
    });

    setMessage(
      `${getMonthLabel(
        selectedMonth
      )} ${chargeYear} fees generated successfully. ${created} new charges created.`
    );

    await loadData();

    setGenerating(false);
  }

  function getMonthLabel(
    month: string
  ) {
    return (
      MONTHS.find(
        (item) =>
          item.value === month
      )?.label || month
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
              CHARGE GENERATION
            </p>

            <h1>
              Generate Monthly Fees
            </h1>

            <p className="muted">
              Loading fee configuration...
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
          maxWidth: 1200,
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
                  '0.05em',
              }}
            >
              CHARGE GENERATION
            </p>

            <h1>
              Generate Monthly Fees
            </h1>

            <p className="muted">
              Automatically create student
              charges from the selected fee
              structure.
            </p>
          </div>

          <div className="fee-active-session">
            <div className="fee-active-session-label">
              ACTIVE SESSION
            </div>

            <div className="fee-active-session-value">
              {years.find(
                (year) =>
                  year.is_active
              )?.name ||
                'Not selected'}
            </div>
          </div>
        </div>

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

        {/* SESSION + MONTH */}

        <section className="fee-section">

          <div className="fee-section-header">
            <h2>
              1. Select Session &amp; Month
            </h2>

            <p>
              Monthly charges will be
              generated using this session's
              fee structure.
            </p>
          </div>

          <div className="grid2">

            <label className="label">
              Academic Year

              <select
                className="select"
                value={selectedYear}
                onChange={(event) => {
                  setSelectedYear(
                    event.target.value
                  );

                  setResult(null);
                  setMessage('');
                  setError('');
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
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="label">
              Month

              <select
                className="select"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(
                    event.target.value
                  );

                  setResult(null);
                  setMessage('');
                  setError('');
                }}
              >
                {MONTHS.map(
                  (month) => (
                    <option
                      key={month.value}
                      value={month.value}
                    >
                      {month.label}
                    </option>
                  )
                )}
              </select>
            </label>

          </div>

        </section>

        {/* WHAT WILL BE GENERATED */}

        <section className="fee-section">

          <div className="fee-section-header">
            <h2>
              2. What Will Be Generated
            </h2>

            <p>
              The system checks every active
              student individually.
            </p>
          </div>

          <div className="cards">

            <div className="card">
              <div className="metric-label">
                Active Students
              </div>

              <div className="metric">
                {students.length}
              </div>
            </div>

            <div className="card">
              <div className="metric-label">
                School Fee Rules
              </div>

              <div className="metric">
                {
                  schoolStructures.length
                }
              </div>
            </div>

            <div className="card">
              <div className="metric-label">
                Hostel Rules
              </div>

              <div className="metric">
                {
                  hostelStructures.length
                }
              </div>
            </div>

            <div className="card">
              <div className="metric-label">
                Vehicle Rules
              </div>

              <div className="metric">
                {
                  vehicleStructures.length
                }
              </div>
            </div>

          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              marginTop: 10,
            }}
          >

            <div
              className="success"
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
              }}
            >
              <span>
                🏫 Class-wise School Fee
              </span>

              <strong>
                {schoolConfiguredClasses.size}{' '}
                classes configured
              </strong>
            </div>

            <div
              className="success"
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
              }}
            >
              <span>
                🏠 Hostel Fee
              </span>

              <strong>
                Added only to hostellers
              </strong>
            </div>

            <div
              className="success"
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
              }}
            >
              <span>
                🚌 Vehicle Fee
              </span>

              <strong>
                Matched by student's route
              </strong>
            </div>

          </div>

        </section>

        {/* GENERATE */}

        <section className="fee-section">

          <div className="fee-section-header">
            <h2>
              3. Generate Charges
            </h2>

            <p>
              Existing charges for the same
              student, session, fee head and
              month will not be duplicated.
            </p>
          </div>

          <div
            className="card"
            style={{
              background:
                '#eff6ff',
              borderColor:
                '#bfdbfe',
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: 13,
                    color: '#64748b',
                  }}
                >
                  GENERATING FOR
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#1e3a8a',
                    marginTop: 4,
                  }}
                >
                  {selectedYearData?.name ||
                    '—'}{' '}
                  ·{' '}
                  {getMonthLabel(
                    selectedMonth
                  )}
                </div>

                <div
                  className="muted"
                  style={{
                    marginTop: 5,
                  }}
                >
                  One click creates the
                  individual student ledger
                  charges.
                </div>

              </div>

              <button
                type="button"
                className="btn"
                onClick={
                  generateMonthlyFees
                }
                disabled={
                  generating ||
                  !selectedYear
                }
                style={{
                  padding:
                    '14px 22px',
                  fontSize: 15,
                }}
              >
                {generating
                  ? 'Generating...'
                  : `Generate ${getMonthLabel(
                      selectedMonth
                    )} Fees`}
              </button>

            </div>

          </div>

        </section>

        {/* RESULT */}

        {result && (
          <section className="fee-section">

            <div className="fee-section-header">
              <h2>
                Generation Result
              </h2>

              <p>
                Summary of the last generation
                operation.
              </p>
            </div>

            <div className="cards">

              <div className="card">
                <div className="metric-label">
                  New Charges
                </div>

                <div
                  className="metric"
                  style={{
                    color:
                      '#067647',
                  }}
                >
                  {result.created}
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  School Fees
                </div>

                <div className="metric">
                  {
                    result.schoolAdded
                  }
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  Hostel Fees
                </div>

                <div className="metric">
                  {
                    result.hostelAdded
                  }
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  Vehicle Fees
                </div>

                <div className="metric">
                  {
                    result.vehicleAdded
                  }
                </div>
              </div>

            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
              }}
            >

              <div className="success">
                <strong>
                  {result.created}
                </strong>{' '}
                new charges created.
              </div>

              {result.skipped > 0 && (
                <div className="card">
                  <strong>
                    {result.skipped}
                  </strong>{' '}
                  charges skipped because
                  they already existed.
                </div>
              )}

              {result.noSchoolFee > 0 && (
                <div className="error">
                  <strong>
                    {result.noSchoolFee}
                  </strong>{' '}
                  students have no
                  class-wise school fee
                  configured.
                </div>
              )}

              {result.noVehicleFee > 0 && (
                <div className="error">
                  <strong>
                    {result.noVehicleFee}
                  </strong>{' '}
                  vehicle students have no
                  matching route fee.
                </div>
              )}

              {result.actualVehicle > 0 && (
                <div
                  className="card"
                  style={{
                    borderColor:
                      '#fcd34d',
                    background:
                      '#fffbeb',
                  }}
                >
                  <strong>
                    {result.actualVehicle}
                  </strong>{' '}
                  vehicle students have
                  <strong>
                    {' '}
                    "As per actual"
                  </strong>{' '}
                  vehicle pricing, so their
                  vehicle charge was not
                  generated until an actual
                  amount is entered.
                </div>
              )}

            </div>

          </section>
        )}

      </div>
    </main>
  );
}
