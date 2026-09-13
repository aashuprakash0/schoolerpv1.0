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

type FeeHead = {
  id: string;
  name: string;
  category: string | null;
  is_recurring: boolean | null;
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
  pricing_type: string | null;
  active: boolean;
  fee_heads?: FeeHead | FeeHead[] | null;
};

type StudentCharge = {
  id: string;
  student_id: string;
  academic_year_id: string | null;
  fee_head_id: string | null;
  charge_name: string;
  charge_type: string;
  period_month: string | null;
  due_date: string | null;
  amount: number;
  notes: string | null;
};

type PaymentAllocation = {
  id: string;
  payment_id: string;
  student_charge_id: string;
  amount: number;
};

type Payment = {
  id: string;
  receipt_no: string | null;
  amount: number;
  payment_mode: 'cash' | 'upi';
  paid_at: string;
  collection_account_id: string | null;
  collector_name: string | null;
  notes: string | null;
};

type CollectionAccount = {
  id: string;
  name: string;
  account_type: string;
  active: boolean;
};

type ChargeBalance = StudentCharge & {
  paid: number;
  balance: number;
};

type BillItem = {
  name: string;
  amount: number;
  fee_head_id: string | null;
};

type ReceiptItem = {
  name: string;
  amount: number;
};

type ReceiptData = {
  receiptNo: string;
  student: Student;
  amount: number;
  mode: string;
  collector: string;
  date: string;
  items: ReceiptItem[];
};

const MONTHS = [
  { value: '04', name: 'April' },
  { value: '05', name: 'May' },
  { value: '06', name: 'June' },
  { value: '07', name: 'July' },
  { value: '08', name: 'August' },
  { value: '09', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
  { value: '01', name: 'January' },
  { value: '02', name: 'February' },
  { value: '03', name: 'March' },
];

function normalize(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function getHeadName(
  head: FeeHead | FeeHead[] | null | undefined
) {
  if (!head) return 'Fee';

  if (Array.isArray(head)) {
    return head[0]?.name || 'Fee';
  }

  return head.name || 'Fee';
}

function getHeadCategory(
  head: FeeHead | FeeHead[] | null | undefined
) {
  if (!head) return '';

  if (Array.isArray(head)) {
    return normalize(head[0]?.category);
  }

  return normalize(head.category);
}

function getMonthName(month: string) {
  return (
    MONTHS.find((item) => item.value === month)?.name ||
    month
  );
}

function getMonthYear(
  academicYear: AcademicYear,
  month: string
) {
  const startYear = academicYear.start_date
    ? Number(academicYear.start_date.slice(0, 4))
    : new Date().getFullYear();

  const monthNumber = Number(month);

  const year =
    monthNumber >= 4 ? startYear : startYear + 1;

  return year;
}

function getPeriodMonth(
  academicYear: AcademicYear,
  month: string
) {
  const year = getMonthYear(academicYear, month);

  return `${year}-${month}-01`;
}

function getNextMonth(month: string) {
  const number = Number(month);

  const next = number === 3 ? 4 : number + 1;

  return String(next).padStart(2, '0');
}

function isMonthly(structure: FeeStructure) {
  return normalize(structure.frequency) === 'monthly';
}

function isSchoolFee(structure: FeeStructure) {
  const name = normalize(
    getHeadName(structure.fee_heads)
  );

  const category = getHeadCategory(
    structure.fee_heads
  );

  return (
    name === 'school fee' ||
    name === 'composite fee' ||
    category === 'school'
  );
}

function isHostelFee(structure: FeeStructure) {
  const name = normalize(
    getHeadName(structure.fee_heads)
  );

  const category = getHeadCategory(
    structure.fee_heads
  );

  return (
    name === 'hostel fee' ||
    category === 'hostel' ||
    structure.hostel_only === true
  );
}

function isVehicleFee(structure: FeeStructure) {
  const name = normalize(
    getHeadName(structure.fee_heads)
  );

  const category = getHeadCategory(
    structure.fee_heads
  );

  return (
    name === 'vehicle fee' ||
    category === 'vehicle' ||
    Boolean(structure.vehicle_area)
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function CollectionPage() {
  const supabase = useMemo(
    () => supabaseBrowser(),
    []
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [structures, setStructures] =
    useState<FeeStructure[]>([]);
  const [charges, setCharges] =
    useState<StudentCharge[]>([]);
  const [allocations, setAllocations] =
    useState<PaymentAllocation[]>([]);
  const [accounts, setAccounts] =
    useState<CollectionAccount[]>([]);

  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [selectedYear, setSelectedYear] =
    useState('');
  const [selectedMonth, setSelectedMonth] =
    useState('09');

  const [amountReceived, setAmountReceived] =
    useState('');

  const [paymentMode, setPaymentMode] =
    useState<'cash' | 'upi'>('cash');

  const [collectionAccountId, setCollectionAccountId] =
    useState('');

  const [collectorName, setCollectorName] =
    useState('');

  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] =
    useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [receipt, setReceipt] =
    useState<ReceiptData | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');

    const [
      studentsResult,
      yearsResult,
      headsResult,
      structuresResult,
      chargesResult,
      allocationsResult,
      accountsResult,
    ] = await Promise.all([
      supabase
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

      supabase
        .from('academic_years')
        .select('*')
        .order('start_date', {
          ascending: false,
        }),

      supabase
        .from('fee_heads')
        .select(`
          id,
          name,
          category,
          is_recurring
        `)
        .order('name'),

      supabase
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

      supabase
        .from('student_charges')
        .select(`
          id,
          student_id,
          academic_year_id,
          fee_head_id,
          charge_name,
          charge_type,
          period_month,
          due_date,
          amount,
          notes
        `),

      supabase
        .from('payment_allocations')
        .select(`
          id,
          payment_id,
          student_charge_id,
          amount
        `),

      supabase
        .from('collection_accounts')
        .select(`
          id,
          name,
          account_type,
          active
        `)
        .eq('active', true)
        .order('name'),
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

    if (allocationsResult.error) {
      setError(
        `Payment allocations: ${allocationsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (accountsResult.error) {
      setError(
        `Collection accounts: ${accountsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setStudents(
      (studentsResult.data || []) as Student[]
    );

    setYears(
      (yearsResult.data || []) as AcademicYear[]
    );

    setHeads(
      (headsResult.data || []) as FeeHead[]
    );

    const normalizedStructures = (
      structuresResult.data || []
    ).map((item: any) => ({
      ...item,
      fee_heads: Array.isArray(item.fee_heads)
        ? item.fee_heads[0] || null
        : item.fee_heads || null,
    })) as FeeStructure[];

    setStructures(normalizedStructures);

    setCharges(
      (chargesResult.data || []) as StudentCharge[]
    );

    setAllocations(
      (allocationsResult.data ||
        []) as PaymentAllocation[]
    );

    setAccounts(
      (accountsResult.data ||
        []) as CollectionAccount[]
    );

    const activeYear =
      (yearsResult.data || []).find(
        (year: AcademicYear) =>
          year.is_active
      ) ||
      (yearsResult.data || [])[0];

    if (activeYear) {
      setSelectedYear(activeYear.id);
    }

    const firstAccount =
      (accountsResult.data || [])[0];

    if (firstAccount) {
      setCollectionAccountId(
        firstAccount.id
      );

      setCollectorName(
        firstAccount.name
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedYearData =
    years.find(
      (year) => year.id === selectedYear
    ) || null;

  const searchResults =
    search.trim().length > 0
      ? students
          .filter((student) => {
            const query =
              search.trim().toLowerCase();

            return (
              student.name
                .toLowerCase()
                .includes(query) ||
              student.admission_no
                .toLowerCase()
                .includes(query) ||
              student.class_name
                .toLowerCase()
                .includes(query) ||
              (student.parent_phone || '')
                .toLowerCase()
                .includes(query)
            );
          })
          .slice(0, 10)
      : [];

  function selectStudent(student: Student) {
    setSelectedStudent(student);

    setSearch(
      `${student.admission_no} — ${student.name}`
    );

    setAmountReceived('');
    setReceipt(null);
    setError('');
    setMessage('');
  }

  function getPaidForCharge(
    chargeId: string
  ) {
    return allocations
      .filter(
        (allocation) =>
          allocation.student_charge_id ===
          chargeId
      )
      .reduce(
        (total, allocation) =>
          total +
          Number(allocation.amount || 0),
        0
      );
  }

  const studentCharges: ChargeBalance[] =
    selectedStudent
      ? charges
          .filter(
            (charge) =>
              charge.student_id ===
                selectedStudent.id &&
              charge.academic_year_id ===
                selectedYear
          )
          .map((charge) => {
            const paid =
              getPaidForCharge(charge.id);

            const balance = Math.max(
              0,
              Number(charge.amount || 0) -
                paid
            );

            return {
              ...charge,
              paid,
              balance,
            };
          })
      : [];

  const outstandingCharges =
    studentCharges
      .filter(
        (charge) => charge.balance > 0
      )
      .sort((a, b) => {
        const aDate =
          a.due_date ||
          a.period_month ||
          '';

        const bDate =
          b.due_date ||
          b.period_month ||
          '';

        return aDate.localeCompare(
          bDate
        );
      });

  const totalOutstanding =
    outstandingCharges.reduce(
      (total, charge) =>
        total + charge.balance,
      0
    );

  const currentPeriod =
    selectedYearData
      ? getPeriodMonth(
          selectedYearData,
          selectedMonth
        )
      : '';

  const currentMonthCharges =
    studentCharges.filter(
      (charge) =>
        charge.period_month ===
        currentPeriod
    );

  const currentMonthTotal =
    currentMonthCharges.reduce(
      (total, charge) =>
        total +
        Number(charge.amount || 0),
      0
    );

  const currentMonthPaid =
    currentMonthCharges.reduce(
      (total, charge) =>
        total + charge.paid,
      0
    );

  const currentMonthOutstanding =
    currentMonthCharges.reduce(
      (total, charge) =>
        total + charge.balance,
      0
    );

  /*
   * NEXT BILL
   */

  const nextMonth = getNextMonth(
    selectedMonth
  );

  const nextPeriod =
    selectedYearData
      ? getPeriodMonth(
          selectedYearData,
          nextMonth
        )
      : '';

  const nextMonthCharges =
    studentCharges.filter(
      (charge) =>
        charge.period_month ===
        nextPeriod
    );

  const nextMonthChargeBalances =
    nextMonthCharges.filter(
      (charge) =>
        charge.balance > 0
    );

  const nextMonthTotal =
    nextMonthCharges.reduce(
      (total, charge) =>
        total +
        Number(charge.amount || 0),
      0
    );

  const nextMonthPaid =
    nextMonthCharges.reduce(
      (total, charge) =>
        total + charge.paid,
      0
    );

  const nextMonthOutstanding =
    nextMonthCharges.reduce(
      (total, charge) =>
        total + charge.balance,
      0
    );

  /*
   * Find configured monthly fees
   */

  const yearStructures =
    structures.filter(
      (structure) =>
        structure.academic_year_id ===
        selectedYear &&
        isMonthly(structure)
    );

  function findSchoolStructure() {
    if (!selectedStudent) return null;

    return (
      yearStructures.find(
        (structure) =>
          isSchoolFee(structure) &&
          normalize(
            structure.class_name
          ) ===
            normalize(
              selectedStudent.class_name
            )
      ) || null
    );
  }

  function findHostelStructure() {
    return (
      yearStructures.find(
        (structure) =>
          isHostelFee(structure)
      ) || null
    );
  }

  function findVehicleStructure() {
    if (
      !selectedStudent ||
      !selectedStudent.vehicle_required ||
      !selectedStudent.vehicle_area
    ) {
      return null;
    }

    const studentArea = normalize(
      selectedStudent.vehicle_area
    );

    return (
      yearStructures.find(
        (structure) => {
          if (
            !isVehicleFee(
              structure
            )
          ) {
            return false;
          }

          const configuredArea =
            normalize(
              structure.vehicle_area
            );

          if (!configuredArea) {
            return false;
          }

          return (
            configuredArea ===
              studentArea ||
            configuredArea.includes(
              studentArea
            ) ||
            studentArea.includes(
              configuredArea
            )
          );
        }
      ) || null
    );
  }

  const schoolStructure =
    findSchoolStructure();

  const hostelStructure =
    findHostelStructure();

  const vehicleStructure =
    findVehicleStructure();

  const nextBillItems: BillItem[] =
    [];

  if (
    schoolStructure &&
    schoolStructure.amount !== null
  ) {
    nextBillItems.push({
      name: `School Fee — ${
        selectedStudent?.class_name || ''
      }`,
      amount: Number(
        schoolStructure.amount
      ),
      fee_head_id:
        schoolStructure.fee_head_id,
    });
  }

  if (
    selectedStudent?.hostel_required &&
    hostelStructure &&
    hostelStructure.amount !== null
  ) {
    nextBillItems.push({
      name: 'Hostel Fee',
      amount: Number(
        hostelStructure.amount
      ),
      fee_head_id:
        hostelStructure.fee_head_id,
    });
  }

  if (
    selectedStudent?.vehicle_required &&
    vehicleStructure &&
    vehicleStructure.amount !== null
  ) {
    nextBillItems.push({
      name: `Vehicle Fee — ${
        selectedStudent.vehicle_area || ''
      }`,
      amount: Number(
        vehicleStructure.amount
      ),
      fee_head_id:
        vehicleStructure.fee_head_id,
    });
  }

  const calculatedNextBill =
    nextBillItems.reduce(
      (total, item) =>
        total + item.amount,
      0
    );

  const nextBillExists =
    nextMonthCharges.length > 0;

  /*
   * GENERATE NEXT BILL
   */

  async function generateNextBill() {
    if (
      !selectedStudent ||
      !selectedYearData
    ) {
      setError(
        'Please select a student and academic year.'
      );
      return;
    }

    if (nextBillExists) {
      setMessage(
        `${getMonthName(
          nextMonth
        )} bill already exists.`
      );
      return;
    }

    if (nextBillItems.length === 0) {
      setError(
        'No monthly fee structure is configured for this student.'
      );
      return;
    }

    if (!schoolStructure) {
      setError(
        `No monthly school fee is configured for ${selectedStudent.class_name}.`
      );
      return;
    }

    if (
      selectedStudent.hostel_required &&
      !hostelStructure
    ) {
      setError(
        'This student is marked as a hosteller, but the monthly hostel fee is not configured.'
      );
      return;
    }

    if (
      selectedStudent.vehicle_required &&
      !vehicleStructure
    ) {
      setError(
        `No vehicle fee is configured for route/area "${selectedStudent.vehicle_area || 'not selected'}".`
      );
      return;
    }

    setGenerating(true);
    setError('');
    setMessage('');

    const rows = nextBillItems.map(
      (item) => ({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear,

        fee_head_id:
          item.fee_head_id,

        charge_name:
          item.name,

        charge_type:
          'monthly',

        period_month:
          nextPeriod,

        due_date:
          nextPeriod,

        amount:
          item.amount,

        notes:
          `Generated from ${selectedYearData.name} fee structure.`,
      })
    );

    const {
      error: insertError,
    } = await supabase
      .from('student_charges')
      .insert(rows);

    if (insertError) {
      setError(
        `Could not generate next bill: ${insertError.message}`
      );
      setGenerating(false);
      return;
    }

    await loadData();

    setMessage(
      `${getMonthName(
        nextMonth
      )} ${getMonthYear(
        selectedYearData,
        nextMonth
      )} bill generated successfully.`
    );

    setGenerating(false);
  }

  /*
   * PAYMENT ALLOCATION PREVIEW
   */

  function getAllocationPreview(
    chargeList: ChargeBalance[],
    amount: number
  ) {
    let remaining = amount;

    return chargeList.map(
      (charge) => {
        const allocation =
          Math.min(
            charge.balance,
            Math.max(
              0,
              remaining
            )
          );

        remaining -= allocation;

        return {
          ...charge,
          allocation,
        };
      }
    );
  }

  const enteredAmount =
    Number(amountReceived || 0);

  const currentAllocationPreview =
    getAllocationPreview(
      outstandingCharges,
      enteredAmount
    );

  const currentAllocationTotal =
    currentAllocationPreview.reduce(
      (total, item) =>
        total + item.allocation,
      0
    );

  /*
   * RECORD PAYMENT
   *
   * This function accepts the exact
   * charges to pay.
   *
   * Therefore it works for both:
   *
   * - old/current outstanding
   * - next bill
   */

  async function recordPaymentForCharges(
    chargeList: ChargeBalance[],
    paymentAmount: number
  ) {
    if (!selectedStudent) {
      setError(
        'Please select a student first.'
      );
      return;
    }

    if (
      !paymentAmount ||
      paymentAmount <= 0
    ) {
      setError(
        'Enter a valid payment amount.'
      );
      return;
    }

    const totalAvailable =
      chargeList.reduce(
        (total, charge) =>
          total + charge.balance,
        0
      );

    if (
      paymentAmount >
      totalAvailable
    ) {
      setError(
        `Payment cannot exceed ${money(
          totalAvailable
        )}.`
      );
      return;
    }

    const preview =
      getAllocationPreview(
        chargeList,
        paymentAmount
      );

    const allocationsToInsert =
      preview
        .filter(
          (item) =>
            item.allocation > 0
        );

    if (
      allocationsToInsert.length ===
      0
    ) {
      setError(
        'No outstanding charge could be allocated.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    setReceipt(null);

    const {
      data: payment,
      error: paymentError,
    } = await supabase
      .from('payments')
      .insert({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear || null,

        amount:
          paymentAmount,

        payment_mode:
          paymentMode,

        collection_account_id:
          collectionAccountId ||
          null,

        collector_name:
          collectorName.trim() ||
          null,

        paid_at:
          new Date().toISOString(),

        notes:
          notes.trim() ||
          null,
      })
      .select(`
        id,
        receipt_no,
        amount,
        payment_mode,
        paid_at,
        collection_account_id,
        collector_name,
        notes
      `)
      .single();

    if (
      paymentError ||
      !payment
    ) {
      setError(
        `Payment could not be saved: ${
          paymentError?.message ||
          'Unknown error'
        }`
      );
      setSaving(false);
      return;
    }

    const allocationRows =
      allocationsToInsert.map(
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
    } = await supabase
      .from('payment_allocations')
      .insert(
        allocationRows
      );

    if (
      allocationError
    ) {
      await supabase
        .from('payments')
        .delete()
        .eq(
          'id',
          payment.id
        );

      setError(
        `Payment was cancelled because allocation failed: ${allocationError.message}`
      );

      setSaving(false);
      return;
    }

    const receiptItems =
      allocationsToInsert.map(
        (item) => ({
          name:
            item.charge_name ||
            getHeadName(
              heads.find(
                (head) =>
                  head.id ===
                  item.fee_head_id
              ) || null
            ),

          amount:
            item.allocation,
        })
      );

    setReceipt({
      receiptNo:
        payment.receipt_no ||
        `RCPT-${payment.id
          .slice(0, 8)
          .toUpperCase()}`,

      student:
        selectedStudent,

      amount:
        paymentAmount,

      mode:
        paymentMode,

      collector:
        collectorName ||
        'School Office',

      date:
        payment.paid_at,

      items:
        receiptItems,
    });

    setAmountReceived('');
    setNotes('');

    setMessage(
      `${money(
        paymentAmount
      )} received successfully.`
    );

    await loadData();

    setSaving(false);
  }

  async function receiveCurrentPayment() {
    if (
      enteredAmount <= 0
    ) {
      setError(
        'Enter the payment amount.'
      );
      return;
    }

    await recordPaymentForCharges(
      outstandingCharges,
      enteredAmount
    );
  }

  /*
   * PAY NEXT BILL
   */

  async function payNextBill() {
    if (
      !selectedStudent ||
      !selectedYearData
    ) {
      setError(
        'Please select a student and academic year.'
      );
      return;
    }

    let chargesToPay =
      nextMonthChargeBalances;

    /*
     * If the bill does not exist yet,
     * generate it first.
     */

    if (!nextBillExists) {
      if (
        calculatedNextBill <=
        0
      ) {
        setError(
          'Next bill amount is ₹0. Check the student class, hostel status and vehicle route.'
        );
        return;
      }

      setGenerating(true);
      setError('');
      setMessage('');

      if (!schoolStructure) {
        setError(
          `No monthly school fee is configured for ${selectedStudent.class_name}.`
        );
        setGenerating(false);
        return;
      }

      if (
        selectedStudent.hostel_required &&
        !hostelStructure
      ) {
        setError(
          'This student is marked as a hosteller, but no monthly hostel fee is configured.'
        );
        setGenerating(false);
        return;
      }

      if (
        selectedStudent.vehicle_required &&
        !vehicleStructure
      ) {
        setError(
          `No vehicle fee is configured for route/area "${selectedStudent.vehicle_area || 'not selected'}".`
        );
        setGenerating(false);
        return;
      }

      const rows =
        nextBillItems.map(
          (item) => ({
            student_id:
              selectedStudent.id,

            academic_year_id:
              selectedYear,

            fee_head_id:
              item.fee_head_id,

            charge_name:
              item.name,

            charge_type:
              'monthly',

            period_month:
              nextPeriod,

            due_date:
              nextPeriod,

            amount:
              item.amount,

            notes:
              `Generated from ${selectedYearData.name} fee structure.`,
          })
        );

      const {
        error: insertError,
      } = await supabase
        .from(
          'student_charges'
        )
        .insert(rows);

      if (insertError) {
        setError(
          `Could not generate next bill: ${insertError.message}`
        );
        setGenerating(false);
        return;
      }

      await loadData();

      /*
       * Re-read the generated charges
       * from the current state after
       * reload.
       *
       * Since state updates are async,
       * fetch them directly here.
       */

      const {
        data: freshCharges,
        error: freshError,
      } = await supabase
        .from('student_charges')
        .select(`
          id,
          student_id,
          academic_year_id,
          fee_head_id,
          charge_name,
          charge_type,
          period_month,
          due_date,
          amount,
          notes
        `)
        .eq(
          'student_id',
          selectedStudent.id
        )
        .eq(
          'academic_year_id',
          selectedYear
        )
        .eq(
          'period_month',
          nextPeriod
        );

      if (freshError) {
        setError(
          `Bill generated but could not be loaded for payment: ${freshError.message}`
        );
        setGenerating(false);
        return;
      }

      chargesToPay =
        (freshCharges || []).map(
          (charge) => ({
            ...charge,
            paid: 0,
            balance:
              Number(
                charge.amount
              ),
          })
        );

      setMessage(
        `${getMonthName(
          nextMonth
        )} bill generated.`
      );

      setGenerating(false);
    }

    if (
      chargesToPay.length ===
      0
    ) {
      setError(
        'There is no outstanding amount on the next bill.'
      );
      return;
    }

    const nextBillBalance =
      chargesToPay.reduce(
        (total, charge) =>
          total + charge.balance,
        0
      );

    const amount =
      Number(
        amountReceived || 0
      );

    if (
      amount <= 0
    ) {
      setError(
        `Enter an amount up to ${money(
          nextBillBalance
        )} for the next bill.`
      );
      return;
    }

    if (
      amount >
      nextBillBalance
    ) {
      setError(
        `Payment cannot exceed ${money(
          nextBillBalance
        )}.`
      );
      return;
    }

    await recordPaymentForCharges(
      chargesToPay,
      amount
    );
  }

  /*
   * PRINT RECEIPT
   */

  function printReceipt() {
    if (!receipt) return;

    const popup =
      window.open(
        '',
        '_blank'
      );

    if (!popup) {
      setError(
        'Please allow pop-ups to print the receipt.'
      );
      return;
    }

    const itemsHtml =
      receipt.items
        .map(
          (item) => `
            <tr>
              <td>
                ${escapeHtml(
                  item.name
                )}
              </td>
              <td class="right">
                ${money(
                  item.amount
                )}
              </td>
            </tr>
          `
        )
        .join('');

    popup.document.write(`
      <!doctype html>

      <html>
        <head>

          <title>
            ${escapeHtml(
              receipt.receiptNo
            )}
          </title>

          <style>

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .receipt {
              width: 100%;
              max-width: 720px;
              margin: 0 auto;
              border: 1px solid #d1d5db;
              padding: 35px;
            }

            .school {
              text-align: center;
              font-size: 27px;
              font-weight: 800;
            }

            .subtitle {
              text-align: center;
              margin-top: 5px;
              color: #64748b;
            }

            .title {
              text-align: center;
              font-size: 20px;
              font-weight: 800;
              margin: 25px 0;
            }

            .info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18px;
              margin-bottom: 25px;
            }

            .label {
              font-size: 12px;
              color: #64748b;
            }

            .value {
              margin-top: 4px;
              font-weight: 700;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            td {
              padding: 11px 0;
              border-bottom: 1px solid #e5e7eb;
            }

            .right {
              text-align: right;
              font-weight: 700;
            }

            .total {
              display: flex;
              justify-content: space-between;
              border-top: 2px solid #111827;
              margin-top: 20px;
              padding-top: 15px;
              font-size: 20px;
              font-weight: 800;
            }

            .footer {
              text-align: center;
              color: #64748b;
              font-size: 12px;
              margin-top: 35px;
            }

            @media print {

              body {
                padding: 0;
              }

              .receipt {
                border: 0;
              }

            }

          </style>

        </head>

        <body>

          <div class="receipt">

            <div class="school">
              Adarsh Avasiya School
            </div>

            <div class="subtitle">
              Fee Collection Receipt
            </div>

            <div class="title">
              PAYMENT RECEIPT
            </div>

            <div class="info">

              <div>
                <div class="label">
                  Receipt No.
                </div>

                <div class="value">
                  ${escapeHtml(
                    receipt.receiptNo
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Date
                </div>

                <div class="value">
                  ${new Date(
                    receipt.date
                  ).toLocaleString(
                    'en-IN'
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Student
                </div>

                <div class="value">
                  ${escapeHtml(
                    receipt.student.name
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Admission No.
                </div>

                <div class="value">
                  ${escapeHtml(
                    receipt.student
                      .admission_no
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Class
                </div>

                <div class="value">
                  ${escapeHtml(
                    `${receipt.student.class_name}-${receipt.student.section}`
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Payment Mode
                </div>

                <div class="value">
                  ${escapeHtml(
                    receipt.mode.toUpperCase()
                  )}
                </div>
              </div>

            </div>

            <table>

              <tbody>
                ${itemsHtml}
              </tbody>

            </table>

            <div class="total">

              <span>
                TOTAL RECEIVED
              </span>

              <span>
                ${money(
                  receipt.amount
                )}
              </span>

            </div>

            <div style="margin-top:20px;">

              <div class="label">
                Collected By
              </div>

              <div class="value">
                ${escapeHtml(
                  receipt.collector
                )}
              </div>

            </div>

            <div class="footer">
              This is a computer-generated receipt.
            </div>

          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>

        </body>
      </html>
    `);

    popup.document.close();
  }

  if (loading) {
    return (
      <main className="main">
        <div
          className="card"
          style={{
            maxWidth: 1000,
            margin: '40px auto',
          }}
        >
          <h2>
            Loading Fee Collection...
          </h2>

          <p className="muted">
            Loading students, fee structures and outstanding balances.
          </p>
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

        {/* PAGE HEADER */}

        <div className="page-head">

          <div>

            <div
              style={{
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing:
                  '0.07em',
                marginBottom: 5,
              }}
            >
              CASH / UPI COLLECTION
            </div>

            <h1>
              Fee Collection
            </h1>

            <p className="muted">
              Search student → review dues → receive payment → print receipt.
            </p>

          </div>

        </div>

        {/* ERROR */}

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

        {/* SUCCESS */}

        {message && (
          <div
            className="success"
            style={{
              marginBottom: 18,
            }}
          >
            ✓ {message}
          </div>
        )}

        {/* 1 SELECT STUDENT */}

        <section className="card">

          <h2>
            1. Select Student
          </h2>

          <p className="muted">
            Search by admission number, student name, class or parent phone.
          </p>

          <div
            style={{
              position: 'relative',
              marginTop: 16,
            }}
          >

            <input
              className="input"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                if (
                  selectedStudent
                ) {
                  setSelectedStudent(
                    null
                  );
                }
              }}
              placeholder="Search admission no., student name, class or phone..."
              autoComplete="off"
            />

            {search.trim() &&
              !selectedStudent &&
              searchResults.length >
                0 && (

                <div
                  style={{
                    position:
                      'absolute',
                    top:
                      'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background:
                      '#fff',
                    border:
                      '1px solid #dfe5ef',
                    borderRadius:
                      12,
                    overflow:
                      'hidden',
                    boxShadow:
                      '0 18px 45px rgba(15,23,42,.14)',
                  }}
                >

                  {searchResults.map(
                    (student) => (

                      <button
                        key={
                          student.id
                        }
                        type="button"
                        onClick={() =>
                          selectStudent(
                            student
                          )
                        }
                        style={{
                          width:
                            '100%',
                          padding:
                            '14px 16px',
                          border:
                            'none',
                          borderBottom:
                            '1px solid #eef1f5',
                          background:
                            '#fff',
                          textAlign:
                            'left',
                          cursor:
                            'pointer',
                        }}
                      >

                        <strong>
                          {
                            student.admission_no
                          }
                        </strong>

                        {' — '}

                        {
                          student.name
                        }

                        <div
                          style={{
                            color:
                              '#667085',
                            fontSize:
                              12,
                            marginTop:
                              4,
                          }}
                        >
                          {
                            student.class_name
                          }
                          -
                          {
                            student.section
                          }

                          {' · Parent: '}

                          {
                            student.parent_phone ||
                            '—'
                          }
                        </div>

                      </button>

                    )
                  )}

                </div>

              )}

            {search.trim() &&
              !selectedStudent &&
              searchResults.length ===
                0 && (

                <div
                  className="muted"
                  style={{
                    marginTop: 10,
                  }}
                >
                  No students found.
                </div>

              )}

          </div>

        </section>

        {selectedStudent && (
          <>

            {/* STUDENT CARD */}

            <section
              className="card"
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
                  alignItems:
                    'center',
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <div
                    style={{
                      color:
                        '#2563eb',
                      fontSize:
                        12,
                      fontWeight:
                        800,
                      letterSpacing:
                        '0.06em',
                    }}
                  >
                    SELECTED STUDENT
                  </div>

                  <h2
                    style={{
                      marginTop: 6,
                    }}
                  >
                    {
                      selectedStudent.name
                    }
                  </h2>

                  <p
                    className="muted"
                    style={{
                      marginTop: 5,
                    }}
                  >
                    {
                      selectedStudent.admission_no
                    }
                    {' · '}
                    {
                      selectedStudent.class_name
                    }
                    -
                    {
                      selectedStudent.section
                    }
                  </p>

                  <p
                    className="muted"
                    style={{
                      marginTop: 5,
                    }}
                  >
                    Parent:{' '}
                    {
                      selectedStudent.parent_name ||
                      '—'
                    }
                    {' · '}
                    {
                      selectedStudent.parent_phone ||
                      '—'
                    }
                  </p>

                </div>

                <div
                  style={{
                    display:
                      'flex',
                    gap: 8,
                    flexWrap:
                      'wrap',
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
                      {
                        selectedStudent.vehicle_area ||
                        'Vehicle'
                      }
                    </span>
                  )}

                </div>

              </div>

            </section>

            {/* 2 SESSION */}

            <section
              className="card"
              style={{
                marginTop: 18,
              }}
            >

              <h2>
                2. Select Session &amp; Month
              </h2>

              <p className="muted">
                Choose the academic session and month to review the bill.
              </p>

              <div
                className="grid2"
                style={{
                  marginTop: 18,
                }}
              >

                <label className="label">
                  Academic Year

                  <select
                    className="select"
                    value={
                      selectedYear
                    }
                    onChange={(
                      event
                    ) => {
                      setSelectedYear(
                        event.target
                          .value
                      );
                      setAmountReceived(
                        ''
                      );
                      setError('');
                      setMessage('');
                    }}
                  >

                    {years.map(
                      (year) => (
                        <option
                          key={
                            year.id
                          }
                          value={
                            year.id
                          }
                        >
                          {
                            year.name
                          }
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
                    value={
                      selectedMonth
                    }
                    onChange={(
                      event
                    ) => {
                      setSelectedMonth(
                        event.target
                          .value
                      );
                      setAmountReceived(
                        ''
                      );
                      setError('');
                      setMessage('');
                    }}
                  >

                    {MONTHS.map(
                      (month) => (
                        <option
                          key={
                            month.value
                          }
                          value={
                            month.value
                          }
                        >
                          {
                            month.name
                          }{' '}
                          {selectedYearData
                            ? getMonthYear(
                                selectedYearData,
                                month.value
                              )
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                </label>

              </div>

            </section>

            {/* CURRENT MONTH */}

            <section
              className="card"
              style={{
                marginTop: 18,
              }}
            >

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  gap: 20,
                  alignItems:
                    'center',
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <div
                    style={{
                      color:
                        '#2563eb',
                      fontSize:
                        12,
                      fontWeight:
                        800,
                    }}
                  >
                    CURRENT BILL
                  </div>

                  <h2
                    style={{
                      marginTop: 5,
                    }}
                  >
                    {
                      getMonthName(
                        selectedMonth
                      )
                    }{' '}
                    {selectedYearData
                      ? getMonthYear(
                          selectedYearData,
                          selectedMonth
                        )
                      : ''}
                  </h2>

                  <p className="muted">
                    Monthly school, hostel and vehicle charges.
                  </p>

                </div>

                <div
                  style={{
                    background:
                      '#111827',
                    color:
                      '#fff',
                    padding:
                      '16px 22px',
                    borderRadius:
                      16,
                    minWidth:
                      210,
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        12,
                      opacity:
                        0.75,
                    }}
                  >
                    OUTSTANDING
                  </div>

                  <div
                    style={{
                      fontSize:
                        30,
                      fontWeight:
                        800,
                      marginTop:
                        5,
                    }}
                  >
                    {money(
                      currentMonthOutstanding
                    )}
                  </div>

                </div>

              </div>

              {currentMonthCharges.length >
                0 ? (

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
                          Fee
                        </th>
                        <th>
                          Bill
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

                      {currentMonthCharges.map(
                        (charge) => (
                          <tr
                            key={
                              charge.id
                            }
                          >

                            <td>
                              <strong>
                                {
                                  charge.charge_name
                                }
                              </strong>
                            </td>

                            <td>
                              {money(
                                Number(
                                  charge.amount
                                )
                              )}
                            </td>

                            <td>
                              {money(
                                charge.paid
                              )}
                            </td>

                            <td>

                              {charge.balance >
                              0 ? (

                                <span className="badge red">
                                  {money(
                                    charge.balance
                                  )}
                                </span>

                              ) : (

                                <span className="badge green">
                                  ✓ PAID
                                </span>

                              )}

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              ) : (

                <div
                  className="empty"
                  style={{
                    marginTop: 18,
                    border:
                      '1px solid #e7ebf2',
                    borderRadius:
                      14,
                  }}
                >
                  No bill has been generated for this month yet.
                </div>

              )}

              {currentMonthCharges.length >
                0 &&
                currentMonthOutstanding ===
                  0 && (

                  <div
                    className="success"
                    style={{
                      marginTop: 16,
                    }}
                  >
                    ✓{' '}
                    <strong>
                      {
                        getMonthName(
                          selectedMonth
                        )
                      }{' '}
                      bill is fully paid.
                    </strong>{' '}
                    The next bill is shown below.
                  </div>

                )}

            </section>

            {/* ALL OUTSTANDING */}

            <section
              className="card"
              style={{
                marginTop: 18,
              }}
            >

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  gap: 20,
                  alignItems:
                    'center',
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <h2>
                    4. Outstanding Dues
                  </h2>

                  <p className="muted">
                    Oldest outstanding charges are paid first.
                  </p>

                </div>

                <div
                  style={{
                    background:
                      '#111827',
                    color:
                      '#fff',
                    padding:
                      '16px 22px',
                    borderRadius:
                      16,
                    minWidth:
                      210,
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        12,
                      opacity:
                        0.75,
                    }}
                  >
                    TOTAL OUTSTANDING
                  </div>

                  <div
                    style={{
                      fontSize:
                        30,
                      fontWeight:
                        800,
                      marginTop:
                        5,
                    }}
                  >
                    {money(
                      totalOutstanding
                    )}
                  </div>

                </div>

              </div>

              {outstandingCharges.length >
              0 ? (

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
                          Month
                        </th>
                        <th>
                          Fee
                        </th>
                        <th>
                          Bill
                        </th>
                        <th>
                          Paid
                        </th>
                        <th>
                          Due
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {outstandingCharges.map(
                        (charge) => (
                          <tr
                            key={
                              charge.id
                            }
                          >

                            <td>
                              {charge.period_month
                                ? new Date(
                                    `${charge.period_month}T00:00:00`
                                  ).toLocaleDateString(
                                    'en-IN',
                                    {
                                      month:
                                        'short',
                                      year:
                                        'numeric',
                                    }
                                  )
                                : '—'}
                            </td>

                            <td>
                              {
                                charge.charge_name
                              }
                            </td>

                            <td>
                              {money(
                                Number(
                                  charge.amount
                                )
                              )}
                            </td>

                            <td>
                              {money(
                                charge.paid
                              )}
                            </td>

                            <td>
                              <span className="badge red">
                                {money(
                                  charge.balance
                                )}
                              </span>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              ) : (

                <div
                  className="success"
                  style={{
                    marginTop: 18,
                  }}
                >
                  ✓ No outstanding dues for this academic session.
                </div>

              )}

            </section>

            {/* PAYMENT SECTION */}

            {totalOutstanding >
              0 && (

              <section
                className="card"
                style={{
                  marginTop: 18,
                }}
              >

                <h2>
                  5. Receive Payment
                </h2>

                <p className="muted">
                  Payment is automatically allocated to the oldest dues first.
                </p>

                <div
                  className="grid2"
                  style={{
                    marginTop: 18,
                  }}
                >

                  <label className="label">
                    Amount Received

                    <input
                      className="input"
                      type="number"
                      min="1"
                      max={
                        totalOutstanding
                      }
                      value={
                        amountReceived
                      }
                      onChange={(
                        event
                      ) =>
                        setAmountReceived(
                          event.target
                            .value
                        )
                      }
                      placeholder={`Maximum ${money(
                        totalOutstanding
                      )}`}
                    />

                  </label>

                  <label className="label">
                    Payment Mode

                    <select
                      className="select"
                      value={
                        paymentMode
                      }
                      onChange={(
                        event
                      ) =>
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

                  <label className="label">
                    Collection Account

                    <select
                      className="select"
                      value={
                        collectionAccountId
                      }
                      onChange={(
                        event
                      ) => {
                        const id =
                          event.target
                            .value;

                        setCollectionAccountId(
                          id
                        );

                        const account =
                          accounts.find(
                            (
                              item
                            ) =>
                              item.id ===
                              id
                          );

                        if (account) {
                          setCollectorName(
                            account.name
                          );
                        }
                      }}
                    >

                      <option value="">
                        Select account
                      </option>

                      {accounts.map(
                        (account) => (
                          <option
                            key={
                              account.id
                            }
                            value={
                              account.id
                            }
                          >
                            {
                              account.name
                            }
                          </option>
                        )
                      )}

                    </select>

                  </label>

                  <label className="label">
                    Collector Name

                    <input
                      className="input"
                      value={
                        collectorName
                      }
                      onChange={(
                        event
                      ) =>
                        setCollectorName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Principal / Vice Principal / Director"
                    />

                  </label>

                </div>

                <label
                  className="label"
                  style={{
                    marginTop: 16,
                  }}
                >
                  Notes

                  <textarea
                    className="textarea"
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional payment note..."
                  />

                </label>

                {enteredAmount >
                  0 && (

                  <div
                    style={{
                      marginTop: 18,
                    }}
                  >

                    <h3>
                      Payment Allocation Preview
                    </h3>

                    <div
                      className="table-wrap"
                      style={{
                        marginTop: 10,
                      }}
                    >

                      <table className="table">

                        <thead>
                          <tr>
                            <th>
                              Fee
                            </th>
                            <th>
                              Outstanding
                            </th>
                            <th>
                              This Payment
                            </th>
                          </tr>
                        </thead>

                        <tbody>

                          {currentAllocationPreview
                            .filter(
                              (item) =>
                                item.allocation >
                                0
                            )
                            .map(
                              (item) => (
                                <tr
                                  key={
                                    item.id
                                  }
                                >

                                  <td>
                                    {
                                      item.charge_name
                                    }
                                  </td>

                                  <td>
                                    {money(
                                      item.balance
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {money(
                                        item.allocation
                                      )}
                                    </strong>
                                  </td>

                                </tr>
                              )
                            )}

                        </tbody>

                      </table>

                    </div>

                    <p
                      className="muted"
                      style={{
                        marginTop: 10,
                      }}
                    >
                      Allocated:{' '}
                      <strong>
                        {money(
                          currentAllocationTotal
                        )}
                      </strong>
                    </p>

                  </div>

                )}

                <button
                  type="button"
                  className="btn"
                  style={{
                    marginTop: 18,
                  }}
                  disabled={
                    saving ||
                    enteredAmount <=
                      0 ||
                    enteredAmount >
                      totalOutstanding
                  }
                  onClick={
                    receiveCurrentPayment
                  }
                >
                  {saving
                    ? 'Recording Payment...'
                    : `Receive ${money(
                        enteredAmount
                      )}`}
                </button>

              </section>

            )}

            {/* NEXT BILL */}

            <section
              className="card"
              style={{
                marginTop: 18,
                border:
                  '1px solid #bfdbfe',
              }}
            >

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  gap: 20,
                  alignItems:
                    'center',
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <div
                    style={{
                      color:
                        '#2563eb',
                      fontSize:
                        12,
                      fontWeight:
                        800,
                      letterSpacing:
                        '0.06em',
                    }}
                  >
                    NEXT BILL
                  </div>

                  <h2
                    style={{
                      marginTop: 5,
                    }}
                  >
                    {
                      getMonthName(
                        nextMonth
                      )
                    }{' '}
                    {selectedYearData
                      ? getMonthYear(
                          selectedYearData,
                          nextMonth
                        )
                      : ''}
                  </h2>

                  <p className="muted">
                    {nextBillExists
                      ? 'The next bill has already been generated.'
                      : 'The next bill will use the configured class, hostel and vehicle fees.'}
                  </p>

                </div>

                <div
                  style={{
                    background:
                      '#eff6ff',
                    border:
                      '1px solid #bfdbfe',
                    borderRadius:
                      16,
                    padding:
                      '16px 22px',
                    minWidth:
                      210,
                  }}
                >

                  <div className="metric-label">
                    NEXT BILL TOTAL
                  </div>

                  <div
                    style={{
                      fontSize:
                        30,
                      fontWeight:
                        800,
                      color:
                        '#173b8f',
                      marginTop:
                        4,
                    }}
                  >
                    {money(
                      nextBillExists
                        ? nextMonthTotal
                        : calculatedNextBill
                    )}
                  </div>

                </div>

              </div>

              {/* BILL COMPONENTS */}

              {!nextBillExists &&
                nextBillItems.length >
                  0 && (

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
                            Fee
                          </th>
                          <th>
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {nextBillItems.map(
                          (item) => (
                            <tr
                              key={
                                item.name
                              }
                            >

                              <td>
                                {
                                  item.name
                                }
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    item.amount
                                  )}
                                </strong>
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              {/* EXISTING NEXT BILL */}

              {nextBillExists &&
                nextMonthCharges.length >
                  0 && (

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
                            Fee
                          </th>
                          <th>
                            Bill
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

                        {nextMonthCharges.map(
                          (charge) => (
                            <tr
                              key={
                                charge.id
                              }
                            >

                              <td>
                                {
                                  charge.charge_name
                                }
                              </td>

                              <td>
                                {money(
                                  Number(
                                    charge.amount
                                  )
                                )}
                              </td>

                              <td>
                                {money(
                                  charge.paid
                                )}
                              </td>

                              <td>

                                {charge.balance >
                                0 ? (

                                  <span className="badge red">
                                    {money(
                                      charge.balance
                                    )}
                                  </span>

                                ) : (

                                  <span className="badge green">
                                    ✓ PAID
                                  </span>

                                )}

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              {/* NO NEXT BILL YET */}

              {!nextBillExists && (
                <div
                  style={{
                    marginTop: 18,
                  }}
                >

                  <button
                    type="button"
                    className="btn"
                    disabled={
                      generating ||
                      calculatedNextBill <=
                        0
                    }
                    onClick={
                      generateNextBill
                    }
                  >
                    {generating
                      ? 'Generating...'
                      : `Generate ${getMonthName(
                          nextMonth
                        )} Bill`}
                  </button>

                </div>
              )}

              {/* NEXT BILL PAID */}

              {nextBillExists &&
                nextMonthOutstanding ===
                  0 && (

                  <div
                    className="success"
                    style={{
                      marginTop: 18,
                    }}
                  >
                    ✓{' '}
                    <strong>
                      {
                        getMonthName(
                          nextMonth
                        )
                      }{' '}
                      bill is already fully paid.
                    </strong>
                  </div>

                )}

              {/* PAY NEXT BILL */}

              {nextBillExists &&
                nextMonthOutstanding >
                  0 && (

                  <div
                    style={{
                      marginTop: 18,
                      padding: 20,
                      background:
                        '#f8fbff',
                      border:
                        '1px solid #dbeafe',
                      borderRadius:
                        14,
                    }}
                  >

                    <h3>
                      Pay Next Bill
                    </h3>

                    <p className="muted">
                      Enter the amount you want to collect for this bill.
                    </p>

                    <div
                      className="grid2"
                      style={{
                        marginTop: 14,
                      }}
                    >

                      <label className="label">
                        Amount

                        <input
                          className="input"
                          type="number"
                          min="1"
                          max={
                            nextMonthOutstanding
                          }
                          value={
                            amountReceived
                          }
                          onChange={(
                            event
                          ) =>
                            setAmountReceived(
                              event.target
                                .value
                            )
                          }
                          placeholder={`Maximum ${money(
                            nextMonthOutstanding
                          )}`}
                        />

                      </label>

                      <label className="label">
                        Payment Mode

                        <select
                          className="select"
                          value={
                            paymentMode
                          }
                          onChange={(
                            event
                          ) =>
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

                    </div>

                    <button
                      type="button"
                      className="btn"
                      style={{
                        marginTop: 16,
                      }}
                      disabled={
                        saving ||
                        Number(
                          amountReceived
                        ) <= 0 ||
                        Number(
                          amountReceived
                        ) >
                          nextMonthOutstanding
                      }
                      onClick={
                        payNextBill
                      }
                    >
                      {saving
                        ? 'Processing...'
                        : `Pay Next Bill ${money(
                            Number(
                              amountReceived ||
                                0
                            )
                          )}`}
                    </button>

                  </div>

                )}

              {/* BILL NOT CONFIGURED */}

              {!nextBillExists &&
                calculatedNextBill <=
                  0 && (

                  <div
                    className="error"
                    style={{
                      marginTop: 18,
                    }}
                  >
                    Next bill cannot be calculated because the required monthly fee structure is not configured.
                  </div>

                )}

            </section>

            {/* RECEIPT */}

            {receipt && (

              <section
                className="card"
                style={{
                  marginTop: 18,
                  marginBottom: 30,
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: 20,
                    flexWrap:
                      'wrap',
                  }}
                >

                  <div>

                    <div
                      style={{
                        color:
                          '#067647',
                        fontSize:
                          12,
                        fontWeight:
                          800,
                      }}
                    >
                      PAYMENT SUCCESSFUL
                    </div>

                    <h2
                      style={{
                        marginTop: 5,
                      }}
                    >
                      Receipt{' '}
                      {
                        receipt.receiptNo
                      }
                    </h2>

                    <p className="muted">
                      {money(
                        receipt.amount
                      )}{' '}
                      received from{' '}
                      {
                        receipt.student
                          .name
                      }
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

              </section>

            )}

          </>
        )}

      </div>

    </main>
  );
}
