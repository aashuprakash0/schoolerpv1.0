'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase';

type Student = {
  id: string;
  admission_no: string;
  name: string;
  class_name: string;
  section: string;
  parent_name: string | null;
  parent_phone: string | null;
  area: string | null;
  hostel_required: boolean;
  vehicle_required: boolean;
  vehicle_area: string | null;
  student_status: string;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type Charge = {
  id: string;
  student_id: string;
  academic_year_id: string | null;
  fee_head_id: string | null;
  charge_name: string;
  charge_type: string;
  amount: number;
  period_month: string | null;
  due_date: string | null;
  notes: string | null;
};

type FeeHead = {
  id: string;
  name: string;
};

type Payment = {
  id: string;
  receipt_no: string | null;
  amount: number;
  payment_mode: string;
  paid_at: string;
  notes: string | null;
};

type Allocation = {
  id: string;
  payment_id: string;
  student_charge_id: string;
  amount: number;
};

type OutstandingCharge = Charge & {
  paid: number;
  balance: number;
};

export default function FeeCollectionPage() {
  const sb = useMemo(() => supabaseBrowser(), []);

  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');

  const [search, setSearch] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: string;
    student: Student;
    amount: number;
    paymentMode: string;
    items: {
      name: string;
      period: string | null;
      amount: number;
    }[];
    date: string;
  } | null>(null);

  const months = [
    { value: '2026-04', label: 'April 2026' },
    { value: '2026-05', label: 'May 2026' },
    { value: '2026-06', label: 'June 2026' },
    { value: '2026-07', label: 'July 2026' },
    { value: '2026-08', label: 'August 2026' },
    { value: '2026-09', label: 'September 2026' },
    { value: '2026-10', label: 'October 2026' },
    { value: '2026-11', label: 'November 2026' },
    { value: '2026-12', label: 'December 2026' },
    { value: '2027-01', label: 'January 2027' },
    { value: '2027-02', label: 'February 2027' },
    { value: '2027-03', label: 'March 2027' },
  ];

  async function loadInitialData() {
    setLoading(true);
    setError('');

    const [
      studentsResult,
      yearsResult,
      headsResult,
      chargesResult,
      paymentsResult,
      allocationsResult,
    ] = await Promise.all([
      sb
        .from('students')
        .select(`
          id,
          admission_no,
          name,
          class_name,
          section,
          parent_name,
          parent_phone,
          area,
          hostel_required,
          vehicle_required,
          vehicle_area,
          student_status
        `)
        .eq('student_status', 'active')
        .order('admission_no'),

      sb
        .from('academic_years')
        .select('*')
        .order('start_date', { ascending: false }),

      sb
        .from('fee_heads')
        .select('id,name')
        .order('name'),

      sb
        .from('student_charges')
        .select(`
          id,
          student_id,
          academic_year_id,
          fee_head_id,
          charge_name,
          charge_type,
          amount,
          period_month,
          due_date,
          notes
        `)
        .order('due_date', { ascending: true }),

      sb
        .from('payments')
        .select(`
          id,
          receipt_no,
          amount,
          payment_mode,
          paid_at,
          notes
        `)
        .order('paid_at', { ascending: false }),

      sb
        .from('payment_allocations')
        .select(`
          id,
          payment_id,
          student_charge_id,
          amount
        `),
    ]);

    if (studentsResult.error) {
      setError(
        `Students: ${studentsResult.error.message}`
      );
      setLoading(false);
      return;
    }

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

    if (chargesResult.error) {
      setError(
        `Student charges: ${chargesResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (paymentsResult.error) {
      setError(
        `Payments: ${paymentsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (allocationsResult.error) {
      setError(
        `Allocations: ${allocationsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setStudents(studentsResult.data || []);
    setYears(yearsResult.data || []);
    setHeads(headsResult.data || []);
    setCharges(chargesResult.data || []);
    setPayments(paymentsResult.data || []);
    setAllocations(allocationsResult.data || []);

    const activeYear =
      (yearsResult.data || []).find(
        (year) => year.is_active
      ) ||
      (yearsResult.data || [])[0];

    if (activeYear) {
      setSelectedYear(activeYear.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  const filteredStudents = students
    .filter((student) => {
      const q = search.toLowerCase().trim();

      if (!q) return true;

      return (
        student.name.toLowerCase().includes(q) ||
        student.admission_no.toLowerCase().includes(q) ||
        (student.parent_phone || '').includes(q) ||
        student.class_name.toLowerCase().includes(q)
      );
    })
    .slice(0, 10);

  function feeHeadName(feeHeadId: string | null) {
    return (
      heads.find(
        (head) => head.id === feeHeadId
      )?.name || 'Fee'
    );
  }

  function paidAgainstCharge(chargeId: string) {
    return allocations
      .filter(
        (allocation) =>
          allocation.student_charge_id === chargeId
      )
      .reduce(
        (sum, allocation) =>
          sum + Number(allocation.amount || 0),
        0
      );
  }

  const studentOutstandingCharges: OutstandingCharge[] =
    selectedStudent
      ? charges
          .filter(
            (charge) =>
              charge.student_id ===
                selectedStudent.id &&
              (!selectedYear ||
                charge.academic_year_id ===
                  selectedYear)
          )
          .map((charge) => {
            const paid = paidAgainstCharge(
              charge.id
            );

            return {
              ...charge,
              paid,
              balance: Math.max(
                0,
                Number(charge.amount) - paid
              ),
            };
          })
          .filter(
            (charge) => charge.balance > 0
          )
      : [];

  const selectedMonthCharges =
    studentOutstandingCharges.filter(
      (charge) => {
        if (!charge.period_month) {
          return true;
        }

        return (
          charge.period_month.slice(0, 7) ===
          selectedMonth
        );
      }
    );

  const allOutstanding =
    studentOutstandingCharges.reduce(
      (sum, charge) =>
        sum + charge.balance,
      0
    );

  const monthOutstanding =
    selectedMonthCharges.reduce(
      (sum, charge) =>
        sum + charge.balance,
      0
    );

  const amount = Number(
    amountReceived || 0
  );

  /*
   * Allocate payment oldest due first.
   */
  const allocationPreview =
    (() => {
      let remaining = amount;

      return studentOutstandingCharges
        .slice()
        .sort((a, b) => {
          const ad =
            a.due_date || '9999-12-31';

          const bd =
            b.due_date || '9999-12-31';

          return ad.localeCompare(bd);
        })
        .map((charge) => {
          if (remaining <= 0) {
            return {
              ...charge,
              allocation: 0,
            };
          }

          const allocation = Math.min(
            remaining,
            charge.balance
          );

          remaining -= allocation;

          return {
            ...charge,
            allocation,
          };
        })
        .filter(
          (charge) =>
            charge.allocation > 0
        );
    })();

  const allocatedTotal =
    allocationPreview.reduce(
      (sum, item) =>
        sum + item.allocation,
      0
    );

  function formatPeriod(
    periodMonth: string | null
  ) {
    if (!periodMonth) {
      return 'General';
    }

    const date = new Date(
      `${periodMonth.slice(0, 7)}-01T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return periodMonth;
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        month: 'short',
        year: 'numeric',
      }
    );
  }

  async function collectPayment() {
    if (!selectedStudent) {
      setError(
        'Select a student first.'
      );
      return;
    }

    if (amount <= 0) {
      setError(
        'Enter the amount received.'
      );
      return;
    }

    if (amount > allOutstanding) {
      setError(
        `Amount cannot exceed total outstanding ₹${allOutstanding.toLocaleString(
          'en-IN'
        )}.`
      );
      return;
    }

    if (
      allocationPreview.length === 0
    ) {
      setError(
        'There is no outstanding charge to allocate.'
      );
      return;
    }

    setCollecting(true);
    setError('');
    setMessage('');
    setLastReceipt(null);

    /*
     * Create ONE payment.
     *
     * Example:
     * ₹5,200 received from parent
     * = ONE payment record.
     */
    const {
      data: payment,
      error: paymentError,
    } = await sb
      .from('payments')
      .insert({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear || null,

        amount,

        payment_mode:
          paymentMode,

        paid_at:
          new Date().toISOString(),

        notes:
          notes || null,
      })
      .select(`
        id,
        receipt_no,
        amount,
        payment_mode,
        paid_at,
        notes
      `)
      .single();

    if (paymentError || !payment) {
      setError(
        `Payment could not be saved: ${
          paymentError?.message ||
          'Unknown error'
        }`
      );

      setCollecting(false);
      return;
    }

    /*
     * Allocate the payment across
     * individual charges.
     */
    const allocationRows =
      allocationPreview.map(
        (item) => ({
          payment_id:
            payment.id,

          student_charge_id:
            item.id,

          amount:
            item.allocation,
        })
      );

    const {
      error: allocationError,
    } = await sb
      .from('payment_allocations')
      .insert(allocationRows);

    if (allocationError) {
      /*
       * Do not leave a payment record
       * behind if allocation failed.
       */
      await sb
        .from('payments')
        .delete()
        .eq(
          'id',
          payment.id
        );

      setError(
        `Payment was not completed because allocation failed: ${allocationError.message}`
      );

      setCollecting(false);
      return;
    }

    const receiptItems =
      allocationPreview.map(
        (item) => ({
          name:
            feeHeadName(
              item.fee_head_id
            ),

          period:
            item.period_month,

          amount:
            item.allocation,
        })
      );

    setLastReceipt({
      receiptNo:
        payment.receipt_no ||
        `RCPT-${payment.id
          .slice(0, 8)
          .toUpperCase()}`,

      student:
        selectedStudent,

      amount,

      paymentMode:
        payment.payment_mode,

      items:
        receiptItems,

      date:
        payment.paid_at,
    });

    setAmountReceived('');
    setNotes('');

    setMessage(
      `₹${amount.toLocaleString(
        'en-IN'
      )} received successfully.`
    );

    await loadInitialData();

    setCollecting(false);
  }

  function printReceipt() {
    if (!lastReceipt) {
      return;
    }

    const printWindow =
      window.open(
        '',
        '_blank'
      );

    if (!printWindow) {
      setError(
        'Please allow pop-ups to print the receipt.'
      );
      return;
    }

    const itemsHtml =
      lastReceipt.items
        .map(
          (item) => `
            <tr>
              <td>
                ${item.name}
                ${
                  item.period
                    ? ` — ${formatPeriod(
                        item.period
                      )}`
                    : ''
                }
              </td>
              <td style="text-align:right">
                ₹${item.amount.toLocaleString(
                  'en-IN'
                )}
              </td>
            </tr>
          `
        )
        .join('');

    printWindow.document.write(`
      <!DOCTYPE html>

      <html>

      <head>

        <title>
          ${lastReceipt.receiptNo}
        </title>

        <style>

          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111827;
          }

          .receipt {
            max-width: 700px;
            margin: auto;
            border: 1px solid #d1d5db;
            padding: 30px;
          }

          h1 {
            text-align: center;
            margin-bottom: 5px;
          }

          .school {
            text-align: center;
            font-size: 14px;
            color: #4b5563;
          }

          .line {
            border-top: 1px solid #d1d5db;
            margin: 20px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          td {
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .total {
            font-size: 20px;
            font-weight: bold;
          }

          .footer {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }

        </style>

      </head>

      <body>

        <div class="receipt">

          <h1>
            ADARSH AVASIYA SCHOOL
          </h1>

          <div class="school">
            FEE RECEIPT
          </div>

          <div class="line"></div>

          <p>
            <strong>Receipt No:</strong>
            ${lastReceipt.receiptNo}
          </p>

          <p>
            <strong>Date:</strong>
            ${new Date(
              lastReceipt.date
            ).toLocaleString('en-IN')}
          </p>

          <p>
            <strong>Student:</strong>
            ${lastReceipt.student.name}
          </p>

          <p>
            <strong>Admission No:</strong>
            ${lastReceipt.student.admission_no}
          </p>

          <p>
            <strong>Class:</strong>
            ${lastReceipt.student.class_name}-${lastReceipt.student.section}
          </p>

          <div class="line"></div>

          <table>

            ${itemsHtml}

            <tr>
              <td class="total">
                TOTAL
              </td>

              <td
                class="total"
                style="text-align:right"
              >
                ₹${lastReceipt.amount.toLocaleString(
                  'en-IN'
                )}
              </td>
            </tr>

          </table>

          <p>
            <strong>
              Payment Mode:
            </strong>

            ${lastReceipt.paymentMode.toUpperCase()}
          </p>

          <div class="footer">

            <span>
              Received By: __________
            </span>

            <span>
              Signature: __________
            </span>

          </div>

        </div>

        <script>

          window.onload = function() {
            window.print();
          };

        </script>

      </body>

      </html>
    `);

    printWindow.document.close();
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
              CASH COLLECTION
            </p>

            <h1>
              Fee Collection
            </h1>

            <p className="muted">
              Loading fee collection...
            </p>
          </div>
        </div>

        <div className="card">
          Loading fee collection...
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

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="page-head">

          <div>

            <p
              style={{
                margin: 0,
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              CASH COLLECTION
            </p>

            <h1>
              Fee Collection
            </h1>

            <p className="muted">
              Search student → review dues →
              receive payment → print receipt.
            </p>

          </div>

        </div>

        {/* ==================================================
            MESSAGES
        =================================================== */}

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

        {/* ==================================================
            1. SEARCH STUDENT
        =================================================== */}

        <section className="collection-card">

          <div
            className="fee-section-header"
            style={{
              marginBottom: 18,
            }}
          >

            <h2>
              1. Select Student
            </h2>

            <p>
              Search by admission number,
              student name, class or parent
              phone.
            </p>

          </div>

          <input
            className="input"
            value={search}
            onChange={(event) => {
              setSearch(
                event.target.value
              );

              setSelectedStudent(null);
              setLastReceipt(null);
              setError('');
              setMessage('');
            }}
            placeholder="Search admission no., student name, class or phone..."
          />

          {search &&
            !selectedStudent && (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid #e7ebf2',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >

                {filteredStudents.length ===
                0 ? (
                  <div className="empty">
                    No students found.
                  </div>
                ) : (
                  filteredStudents.map(
                    (student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(
                            student
                          );

                          setSearch(
                            `${student.admission_no} — ${student.name}`
                          );

                          setError('');
                          setMessage('');
                        }}
                        style={{
                          width: '100%',
                          border: 0,
                          borderBottom:
                            '1px solid #edf0f5',
                          background:
                            '#ffffff',
                          padding: 16,
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >

                        <div>

                          <strong>
                            {student.name}
                          </strong>

                          <div
                            className="muted"
                            style={{
                              fontSize: 13,
                              marginTop: 4,
                            }}
                          >
                            {student.admission_no}
                            {' · '}
                            {student.class_name}-
                            {student.section}
                          </div>

                          <div
                            className="muted"
                            style={{
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            Parent:{' '}
                            {student.parent_name ||
                              '—'}
                            {' · '}
                            {student.parent_phone ||
                              '—'}
                          </div>

                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            justifyContent:
                              'flex-end',
                          }}
                        >

                          {student.hostel_required && (
                            <span className="badge green">
                              Hostel
                            </span>
                          )}

                          {student.vehicle_required && (
                            <span className="badge">
                              Vehicle
                            </span>
                          )}

                        </div>

                      </button>
                    )
                  )
                )}

              </div>
            )}

        </section>

        {/* ==================================================
            SELECTED STUDENT
        =================================================== */}

        {selectedStudent && (
          <>

            <section
              className="collection-card"
              style={{
                marginTop: 18,
              }}
            >

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >

                <div>

                  <p
                    style={{
                      margin: 0,
                      color: '#2563eb',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    SELECTED STUDENT
                  </p>

                  <h2
                    style={{
                      marginTop: 5,
                    }}
                  >
                    {selectedStudent.name}
                  </h2>

                  <p
                    className="muted"
                    style={{
                      margin: '5px 0',
                    }}
                  >
                    {selectedStudent.admission_no}
                    {' · '}
                    {selectedStudent.class_name}-
                    {selectedStudent.section}
                  </p>

                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      fontSize: 13,
                    }}
                  >
                    Parent:{' '}
                    {selectedStudent.parent_name ||
                      '—'}
                    {' · '}
                    {selectedStudent.parent_phone ||
                      '—'}
                  </p>

                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >

                  {selectedStudent.hostel_required && (
                    <span className="badge green">
                      🏠 Hostel
                    </span>
                  )}

                  {selectedStudent.vehicle_required && (
                    <span className="badge">
                      🚌{' '}
                      {selectedStudent.vehicle_area ||
                        'Vehicle'}
                    </span>
                  )}

                </div>

              </div>

            </section>

            {/* ==================================================
                2. YEAR / MONTH
            =================================================== */}

            <section
              className="collection-card"
              style={{
                marginTop: 18,
              }}
            >

              <div className="fee-section-header">
                <h2>
                  2. Select Session &amp; Month
                </h2>

                <p>
                  Choose the academic session
                  and month to review dues.
                </p>
              </div>

              <div className="grid2">

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
                      </option>
                    ))}

                  </select>

                </label>

                <label className="label">

                  Month

                  <select
                    className="select"
                    value={selectedMonth}
                    onChange={(event) =>
                      setSelectedMonth(
                        event.target.value
                      )
                    }
                  >

                    {months.map((month) => (
                      <option
                        key={month.value}
                        value={month.value}
                      >
                        {month.label}
                      </option>
                    ))}

                  </select>

                </label>

              </div>

            </section>

            {/* ==================================================
                3. OUTSTANDING
            =================================================== */}

            <section
              className="collection-card"
              style={{
                marginTop: 18,
              }}
            >

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'flex-end',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >

                <div>

                  <h2>
                    3. Outstanding Fees
                  </h2>

                  <p
                    className="muted"
                    style={{
                      marginTop: 5,
                    }}
                  >
                    Oldest outstanding charges
                    are allocated first.
                  </p>

                </div>

                <div
                  className="collection-total"
                  style={{
                    minWidth: 240,
                  }}
                >

                  <div className="collection-total-label">
                    TOTAL OUTSTANDING
                  </div>

                  <div className="collection-total-value">
                    ₹
                    {allOutstanding.toLocaleString(
                      'en-IN'
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: '#cbd5e1',
                    }}
                  >
                    Selected month:{' '}
                    ₹
                    {monthOutstanding.toLocaleString(
                      'en-IN'
                    )}
                  </div>

                </div>

              </div>

              <div
                className="fee-table-wrap"
                style={{
                  marginTop: 20,
                }}
              >

                {studentOutstandingCharges.length ===
                0 ? (
                  <div className="empty">
                    <strong>
                      No outstanding fees.
                    </strong>

                    <p>
                      This student has no
                      unpaid charges for the
                      selected session.
                    </p>
                  </div>
                ) : (
                  <table className="fee-table">

                    <thead>

                      <tr>

                        <th>
                          Fee Head
                        </th>

                        <th>
                          Period
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Paid
                        </th>

                        <th>
                          Balance
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {studentOutstandingCharges.map(
                        (charge) => (
                          <tr key={charge.id}>

                            <td>
                              <strong>
                                {feeHeadName(
                                  charge.fee_head_id
                                )}
                              </strong>

                              {charge.charge_name &&
                                charge.charge_name !==
                                  feeHeadName(
                                    charge.fee_head_id
                                  ) && (
                                  <div
                                    className="muted"
                                    style={{
                                      marginTop: 3,
                                      fontSize: 12,
                                    }}
                                  >
                                    {
                                      charge.charge_name
                                    }
                                  </div>
                                )}
                            </td>

                            <td>
                              {formatPeriod(
                                charge.period_month
                              )}
                            </td>

                            <td>
                              ₹
                              {Number(
                                charge.amount
                              ).toLocaleString(
                                'en-IN'
                              )}
                            </td>

                            <td>
                              ₹
                              {Number(
                                charge.paid
                              ).toLocaleString(
                                'en-IN'
                              )}
                            </td>

                            <td>
                              <span className="badge red">
                                ₹
                                {Number(
                                  charge.balance
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </span>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>
                )}

              </div>

            </section>

            {/* ==================================================
                4. RECEIVE PAYMENT
            =================================================== */}

            {allOutstanding > 0 && (
              <section
                className="collection-card"
                style={{
                  marginTop: 18,
                }}
              >

                <div className="fee-section-header">
                  <h2>
                    4. Receive Payment
                  </h2>

                  <p>
                    Enter the amount actually
                    received from the parent.
                  </p>
                </div>

                <div className="grid2">

                  <div>

                    <label className="label">

                      Amount Received

                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="0.01"
                        value={
                          amountReceived
                        }
                        onChange={(event) =>
                          setAmountReceived(
                            event.target
                              .value
                          )
                        }
                        placeholder="Enter amount"
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          padding: 15,
                        }}
                      />

                    </label>

                    <div
                      className="fee-action-group"
                      style={{
                        marginTop: 10,
                      }}
                    >

                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() =>
                          setAmountReceived(
                            String(
                              allOutstanding
                            )
                          )
                        }
                      >
                        Full Outstanding
                      </button>

                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() =>
                          setAmountReceived(
                            String(
                              monthOutstanding
                            )
                          )
                        }
                      >
                        This Month
                      </button>

                    </div>

                  </div>

                  <div>

                    <label className="label">

                      Payment Mode

                      <select
                        className="select"
                        value={paymentMode}
                        onChange={(event) =>
                          setPaymentMode(
                            event.target
                              .value as
                              | 'cash'
                              | 'upi'
                          )
                        }
                      >

                        <option value="cash">
                          Cash
                        </option>

                        <option value="upi">
                          UPI
                        </option>

                      </select>

                    </label>

                    <label
                      className="label"
                      style={{
                        marginTop: 14,
                      }}
                    >

                      Notes

                      <textarea
                        className="textarea"
                        value={notes}
                        onChange={(event) =>
                          setNotes(
                            event.target
                              .value
                          )
                        }
                        placeholder="Optional note..."
                      />

                    </label>

                  </div>

                </div>

                {/* ==================================================
                    ALLOCATION PREVIEW
                =================================================== */}

                {amount > 0 && (
                  <div
                    className="card"
                    style={{
                      marginTop: 20,
                      background: '#f8fafc',
                    }}
                  >

                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 15,
                      }}
                    >

                      <span className="muted">
                        Amount received
                      </span>

                      <strong>
                        ₹
                        {amount.toLocaleString(
                          'en-IN'
                        )}
                      </strong>

                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 15,
                        marginTop: 8,
                      }}
                    >

                      <span className="muted">
                        Will be allocated
                      </span>

                      <strong>
                        ₹
                        {allocatedTotal.toLocaleString(
                          'en-IN'
                        )}
                      </strong>

                    </div>

                    {amount >
                      allocatedTotal && (
                      <div
                        className="error"
                        style={{
                          marginTop: 12,
                        }}
                      >
                        Amount is greater than
                        the available
                        outstanding balance.
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 18,
                        borderTop:
                          '1px solid #e2e8f0',
                        paddingTop: 12,
                      }}
                    >

                      {allocationPreview.map(
                        (item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent:
                                'space-between',
                              gap: 15,
                              padding:
                                '9px 0',
                              borderBottom:
                                '1px solid #edf0f5',
                            }}
                          >

                            <span>
                              {feeHeadName(
                                item.fee_head_id
                              )}

                              {item.period_month
                                ? ` — ${formatPeriod(
                                    item.period_month
                                  )}`
                                : ''}
                            </span>

                            <strong>
                              ₹
                              {item.allocation.toLocaleString(
                                'en-IN'
                              )}
                            </strong>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

                <button
                  type="button"
                  className="btn"
                  onClick={
                    collectPayment
                  }
                  disabled={
                    collecting ||
                    amount <= 0 ||
                    amount >
                      allOutstanding ||
                    allocationPreview.length ===
                      0
                  }
                  style={{
                    width: '100%',
                    marginTop: 20,
                    padding: 15,
                    fontSize: 16,
                  }}
                >
                  {collecting
                    ? 'Recording Payment...'
                    : `Receive ${
                        paymentMode ===
                        'cash'
                          ? 'Cash'
                          : 'UPI'
                      } ₹${amount.toLocaleString(
                        'en-IN'
                      )}`}
                </button>

              </section>
            )}

            {/* ==================================================
                RECEIPT
            =================================================== */}

            {lastReceipt && (
              <section
                className="collection-card"
                style={{
                  marginTop: 18,
                  borderColor: '#abefc6',
                  background: '#f0fdf4',
                }}
              >

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

                    <p
                      style={{
                        margin: 0,
                        color: '#067647',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      PAYMENT SUCCESSFUL
                    </p>

                    <h2
                      style={{
                        marginTop: 5,
                      }}
                    >
                      ₹
                      {lastReceipt.amount.toLocaleString(
                        'en-IN'
                      )}
                    </h2>

                    <p
                      className="muted"
                      style={{
                        margin: 4,
                      }}
                    >
                      Receipt:{' '}
                      {lastReceipt.receiptNo}
                    </p>

                    <p
                      className="muted"
                      style={{
                        margin: 0,
                        fontSize: 13,
                      }}
                    >
                      Mode:{' '}
                      {lastReceipt.paymentMode.toUpperCase()}
                    </p>

                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={
                      printReceipt
                    }
                  >
                    🖨 Print Receipt
                  </button>

                </div>

                <div
                  className="card"
                  style={{
                    marginTop: 18,
                  }}
                >

                  {lastReceipt.items.map(
                    (item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        style={{
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          gap: 15,
                          padding:
                            '10px 0',
                          borderBottom:
                            '1px solid #edf0f5',
                        }}
                      >

                        <span>
                          {item.name}

                          {item.period
                            ? ` — ${formatPeriod(
                                item.period
                              )}`
                            : ''}
                        </span>

                        <strong>
                          ₹
                          {item.amount.toLocaleString(
                            'en-IN'
                          )}
                        </strong>

                      </div>
                    )
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      marginTop: 15,
                      paddingTop: 15,
                      borderTop:
                        '2px solid #d0d5dd',
                      fontSize: 20,
                      fontWeight: 800,
                    }}
                  >

                    <span>
                      TOTAL
                    </span>

                    <span>
                      ₹
                      {lastReceipt.amount.toLocaleString(
                        'en-IN'
                      )}
                    </span>

                  </div>

                </div>

              </section>
            )}

          </>
        )}

      </div>

    </main>
  );
}
