'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabase';

type Student = {
  id: string;
  admission_no: string;
  name: string;
  class_name: string;
  section: string;
  parent_name: string;
  parent_phone: string;
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
  amount: number;
  period: string | null;
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
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: string;
    student: Student;
    amount: number;
    items: {
      name: string;
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
          amount,
          period,
          due_date,
          notes
        `),

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
      setError(`Students: ${studentsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (yearsResult.error) {
      setError(`Academic years: ${yearsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (headsResult.error) {
      setError(`Fee heads: ${headsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (chargesResult.error) {
      setError(`Student charges: ${chargesResult.error.message}`);
      setLoading(false);
      return;
    }

    if (paymentsResult.error) {
      setError(`Payments: ${paymentsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (allocationsResult.error) {
      setError(`Allocations: ${allocationsResult.error.message}`);
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
      (yearsResult.data || []).find((y) => y.is_active) ||
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
        student.parent_phone.includes(q) ||
        student.class_name.toLowerCase().includes(q)
      );
    })
    .slice(0, 10);

  function feeHeadName(feeHeadId: string | null) {
    return (
      heads.find((head) => head.id === feeHeadId)?.name ||
      'Fee'
    );
  }

  function paidAgainstCharge(chargeId: string) {
    return allocations
      .filter((a) => a.student_charge_id === chargeId)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }

  const studentOutstandingCharges = selectedStudent
    ? charges
        .filter(
          (charge) =>
            charge.student_id === selectedStudent.id &&
            (!selectedYear || charge.academic_year_id === selectedYear)
        )
        .map((charge) => {
          const paid = paidAgainstCharge(charge.id);

          return {
            ...charge,
            paid,
            balance: Math.max(0, Number(charge.amount) - paid),
          };
        })
        .filter((charge) => charge.balance > 0)
    : [];

  const selectedMonthCharges = studentOutstandingCharges.filter((charge) => {
    if (!charge.period) return true;
    return charge.period === selectedMonth;
  });

  const allOutstanding = studentOutstandingCharges.reduce(
    (sum, charge) => sum + charge.balance,
    0
  );

  const monthOutstanding = selectedMonthCharges.reduce(
    (sum, charge) => sum + charge.balance,
    0
  );

  const amount = Number(amountReceived || 0);

  const allocationPreview = (() => {
    let remaining = amount;

    return studentOutstandingCharges
      .slice()
      .sort((a, b) => {
        const ad = a.due_date || '9999-12-31';
        const bd = b.due_date || '9999-12-31';
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
      .filter((charge) => charge.allocation > 0);
  })();

  const allocatedTotal = allocationPreview.reduce(
    (sum, item) => sum + item.allocation,
    0
  );

  async function collectCash() {
    if (!selectedStudent) {
      setError('Select a student first.');
      return;
    }

    if (amount <= 0) {
      setError('Enter the amount received.');
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

    if (allocationPreview.length === 0) {
      setError('There is no outstanding charge to allocate.');
      return;
    }

    setCollecting(true);
    setError('');
    setMessage('');
    setLastReceipt(null);

    /*
      Step 1:
      Create one payment for the whole amount.

      Example:
      ₹5,200 is recorded as ONE payment.
    */

    const { data: payment, error: paymentError } = await sb
      .from('payments')
      .insert({
        student_id: selectedStudent.id,
        amount,
        payment_mode: 'cash',
        paid_at: new Date().toISOString(),
        notes: notes || null,
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
          paymentError?.message || 'Unknown error'
        }`
      );
      setCollecting(false);
      return;
    }

    /*
      Step 2:
      Allocate the one payment across individual charges.

      This is what keeps:
      School Fee
      Hostel Fee
      Vehicle Fee

      separately traceable.
    */

    const allocationRows = allocationPreview.map((item) => ({
      payment_id: payment.id,
      student_charge_id: item.id,
      amount: item.allocation,
    }));

    const { error: allocationError } = await sb
      .from('payment_allocations')
      .insert(allocationRows);

    if (allocationError) {
      // Important: don't silently pretend collection succeeded.
      await sb
        .from('payments')
        .delete()
        .eq('id', payment.id);

      setError(
        `Payment was not completed because allocation failed: ${allocationError.message}`
      );

      setCollecting(false);
      return;
    }

    const receiptItems = allocationPreview.map((item) => ({
      name: feeHeadName(item.fee_head_id),
      amount: item.allocation,
    }));

    setLastReceipt({
      receiptNo:
        payment.receipt_no || `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
      student: selectedStudent,
      amount,
      items: receiptItems,
      date: payment.paid_at,
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
    if (!lastReceipt) return;

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setError('Please allow pop-ups to print the receipt.');
      return;
    }

    const itemsHtml = lastReceipt.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:right">
              ₹${item.amount.toLocaleString('en-IN')}
            </td>
          </tr>
        `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${lastReceipt.receiptNo}</title>

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

          <h1>ADARSH AVASIYA SCHOOL</h1>

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
            ${new Date(lastReceipt.date).toLocaleString('en-IN')}
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
              <td class="total">TOTAL</td>
              <td class="total" style="text-align:right">
                ₹${lastReceipt.amount.toLocaleString('en-IN')}
              </td>
            </tr>
          </table>

          <p>
            <strong>Payment Mode:</strong> CASH
          </p>

          <div class="footer">
            <span>Received By: __________</span>
            <span>Signature: __________</span>
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
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          Loading fee collection...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700">
            CASH COLLECTION
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Fee Collection
          </h1>

          <p className="mt-1 text-slate-500">
            Search student → review dues → receive cash → print receipt.
          </p>
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* SEARCH */}

        <section className="rounded-2xl bg-white p-6 shadow-sm">

          <h2 className="text-xl font-bold">
            1. Select Student
          </h2>

          <div className="mt-4">

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedStudent(null);
              }}
              placeholder="Search admission no., student name, class or phone..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
            />

            {search && !selectedStudent && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">

                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No students found.
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setSearch(
                          `${student.admission_no} — ${student.name}`
                        );
                      }}
                      className="flex w-full items-center justify-between border-b p-4 text-left last:border-0 hover:bg-slate-50"
                    >

                      <div>
                        <p className="font-semibold text-slate-900">
                          {student.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {student.admission_no} ·{' '}
                          {student.class_name}-{student.section}
                        </p>
                      </div>

                      <div className="text-right text-sm">
                        <p>
                          {student.hostel_required
                            ? '🏠 Hostel'
                            : ''}
                        </p>

                        <p>
                          {student.vehicle_required
                            ? '🚌 Vehicle'
                            : ''}
                        </p>
                      </div>

                    </button>
                  ))
                )}

              </div>
            )}

          </div>

        </section>

        {/* STUDENT */}

        {selectedStudent && (
          <>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    SELECTED STUDENT
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedStudent.name}
                  </h2>

                  <p className="mt-1 text-slate-500">
                    {selectedStudent.admission_no} ·{' '}
                    {selectedStudent.class_name}-
                    {selectedStudent.section}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Parent: {selectedStudent.parent_name} ·{' '}
                    {selectedStudent.parent_phone}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">

                  {selectedStudent.hostel_required && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                      Hostel
                    </span>
                  )}

                  {selectedStudent.vehicle_required && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                      {selectedStudent.vehicle_area || 'Vehicle'}
                    </span>
                  )}

                </div>

              </div>

            </section>

            {/* MONTH */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

              <h2 className="text-xl font-bold">
                2. Select Month
              </h2>

              <div className="mt-4 flex flex-col gap-4 md:flex-row">

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3"
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) =>
                    setSelectedMonth(e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3"
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

              </div>

            </section>

            {/* OUTSTANDING */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

                <div>
                  <h2 className="text-xl font-bold">
                    3. Outstanding Fees
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Oldest outstanding charges are allocated first.
                  </p>
                </div>

                <div className="text-right">

                  <p className="text-sm text-slate-500">
                    Selected Month
                  </p>

                  <p className="text-2xl font-bold text-blue-700">
                    ₹{monthOutstanding.toLocaleString('en-IN')}
                  </p>

                  <p className="text-sm text-slate-500">
                    Total outstanding: ₹
                    {allOutstanding.toLocaleString('en-IN')}
                  </p>

                </div>

              </div>

              <div className="mt-5 overflow-x-auto">

                {studentOutstandingCharges.length === 0 ? (
                  <div className="rounded-xl bg-green-50 p-5 text-green-700">
                    <strong>No outstanding fees.</strong>
                  </div>
                ) : (
                  <table className="w-full min-w-[650px]">

                    <thead>
                      <tr className="border-b text-left text-sm text-slate-500">
                        <th className="px-3 py-3">
                          Fee Head
                        </th>

                        <th className="px-3 py-3">
                          Period
                        </th>

                        <th className="px-3 py-3">
                          Amount
                        </th>

                        <th className="px-3 py-3">
                          Paid
                        </th>

                        <th className="px-3 py-3">
                          Balance
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {studentOutstandingCharges.map((charge) => (
                        <tr
                          key={charge.id}
                          className="border-b last:border-0"
                        >

                          <td className="px-3 py-4 font-semibold">
                            {feeHeadName(charge.fee_head_id)}
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-500">
                            {charge.period || 'General'}
                          </td>

                          <td className="px-3 py-4">
                            ₹{Number(charge.amount).toLocaleString('en-IN')}
                          </td>

                          <td className="px-3 py-4">
                            ₹{Number(charge.paid).toLocaleString('en-IN')}
                          </td>

                          <td className="px-3 py-4 font-bold text-red-600">
                            ₹{Number(charge.balance).toLocaleString('en-IN')}
                          </td>

                        </tr>
                      ))}

                    </tbody>

                  </table>
                )}

              </div>

            </section>

            {/* PAYMENT */}

            {allOutstanding > 0 && (
              <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

                <h2 className="text-xl font-bold">
                  4. Receive Cash
                </h2>

                <div className="mt-5 grid gap-5 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-semibold">
                      Amount Received
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={amountReceived}
                      onChange={(e) =>
                        setAmountReceived(e.target.value)
                      }
                      placeholder="Enter cash amount"
                      className="w-full rounded-xl border border-slate-300 px-4 py-4 text-xl font-bold outline-none focus:border-blue-600"
                    />

                    <div className="mt-2 flex gap-2">

                      <button
                        onClick={() =>
                          setAmountReceived(
                            String(allOutstanding)
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Full Outstanding
                      </button>

                      <button
                        onClick={() =>
                          setAmountReceived(
                            String(monthOutstanding)
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        This Month
                      </button>

                    </div>

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-semibold">
                      Notes
                    </label>

                    <textarea
                      value={notes}
                      onChange={(e) =>
                        setNotes(e.target.value)
                      }
                      placeholder="Optional note..."
                      rows={4}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    />

                  </div>

                </div>

                {/* PREVIEW */}

                {amount > 0 && (
                  <div className="mt-6 rounded-xl bg-slate-50 p-5">

                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Amount received
                      </span>

                      <strong>
                        ₹{amount.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <div className="mt-2 flex justify-between">
                      <span className="text-slate-500">
                        Will be allocated
                      </span>

                      <strong>
                        ₹{allocatedTotal.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    {amount > allocatedTotal && (
                      <p className="mt-3 text-sm font-semibold text-red-600">
                        Amount is greater than the available
                        outstanding balance.
                      </p>
                    )}

                    <div className="mt-4 border-t pt-4">

                      {allocationPreview.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between py-2 text-sm"
                        >

                          <span>
                            {feeHeadName(item.fee_head_id)}
                            {item.period
                              ? ` — ${item.period}`
                              : ''}
                          </span>

                          <strong>
                            ₹{item.allocation.toLocaleString('en-IN')}
                          </strong>

                        </div>
                      ))}

                    </div>

                  </div>
                )}

                <button
                  onClick={collectCash}
                  disabled={
                    collecting ||
                    amount <= 0 ||
                    amount > allOutstanding ||
                    allocationPreview.length === 0
                  }
                  className="mt-6 w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {collecting
                    ? 'Recording Cash...'
                    : `Receive Cash ₹${amount.toLocaleString(
                        'en-IN'
                      )}`}
                </button>

              </section>
            )}

            {/* RECEIPT */}

            {lastReceipt && (
              <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div>

                    <p className="text-sm font-semibold text-green-700">
                      PAYMENT SUCCESSFUL
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      ₹{lastReceipt.amount.toLocaleString('en-IN')}
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      Receipt: {lastReceipt.receiptNo}
                    </p>

                  </div>

                  <button
                    onClick={printReceipt}
                    className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white hover:bg-slate-800"
                  >
                    Print Receipt
                  </button>

                </div>

                <div className="mt-5 rounded-xl bg-white p-5">

                  {lastReceipt.items.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex justify-between border-b py-3 last:border-0"
                    >
                      <span>{item.name}</span>

                      <strong>
                        ₹{item.amount.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  ))}

                  <div className="mt-3 flex justify-between border-t pt-4 text-xl font-bold">

                    <span>TOTAL</span>

                    <span>
                      ₹{lastReceipt.amount.toLocaleString('en-IN')}
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
