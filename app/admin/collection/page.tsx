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
  pricing_type: string;
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

type ChargeWithBalance =
  StudentCharge & {
    paid: number;
    balance: number;
  };

type ReceiptItem = {
  name: string;
  amount: number;
};

type LastReceipt = {
  receiptNo: string;
  student: Student;
  amount: number;
  mode: string;
  collector: string;
  date: string;
  items: ReceiptItem[];
};

const MONTHS = [
  {
    value: '04',
    label: 'April',
  },
  {
    value: '05',
    label: 'May',
  },
  {
    value: '06',
    label: 'June',
  },
  {
    value: '07',
    label: 'July',
  },
  {
    value: '08',
    label: 'August',
  },
  {
    value: '09',
    label: 'September',
  },
  {
    value: '10',
    label: 'October',
  },
  {
    value: '11',
    label: 'November',
  },
  {
    value: '12',
    label: 'December',
  },
  {
    value: '01',
    label: 'January',
  },
  {
    value: '02',
    label: 'February',
  },
  {
    value: '03',
    label: 'March',
  },
];

function normalise(
  value: string | null | undefined
) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function feeHeadName(
  head: FeeHead | FeeHead[] | null | undefined
) {
  if (!head) {
    return 'Fee';
  }

  if (Array.isArray(head)) {
    return head[0]?.name || 'Fee';
  }

  return head.name;
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

function getPeriodDate(
  year: AcademicYear,
  month: string
) {
  const startYear = year.start_date
    ? Number(
        year.start_date.slice(0, 4)
      )
    : new Date().getFullYear();

  const monthNumber = Number(month);

  const actualYear =
    monthNumber >= 4
      ? startYear
      : startYear + 1;

  return `${actualYear}-${month}-01`;
}

function getNextMonth(
  year: AcademicYear,
  currentMonth: string
) {
  const current =
    Number(currentMonth);

  const next =
    current === 3
      ? 4
      : current + 1;

  return String(next).padStart(
    2,
    '0'
  );
}

function isSchoolFee(
  structure: FeeStructure
) {
  const name = normalise(
    feeHeadName(
      structure.fee_heads
    )
  );

  const category = normalise(
    Array.isArray(
      structure.fee_heads
    )
      ? structure.fee_heads[0]?.category
      : structure.fee_heads?.category
  );

  return (
    name === 'composite fee' ||
    name === 'school fee' ||
    category === 'school'
  );
}

function isHostelFee(
  structure: FeeStructure
) {
  const name = normalise(
    feeHeadName(
      structure.fee_heads
    )
  );

  const category = normalise(
    Array.isArray(
      structure.fee_heads
    )
      ? structure.fee_heads[0]?.category
      : structure.fee_heads?.category
  );

  return (
    name === 'hostel fee' ||
    category === 'hostel' ||
    structure.hostel_only
  );
}

function isVehicleFee(
  structure: FeeStructure
) {
  const name = normalise(
    feeHeadName(
      structure.fee_heads
    )
  );

  const category = normalise(
    Array.isArray(
      structure.fee_heads
    )
      ? structure.fee_heads[0]?.category
      : structure.fee_heads?.category
  );

  return (
    name === 'vehicle fee' ||
    category === 'vehicle' ||
    Boolean(
      structure.vehicle_area
    )
  );
}

export default function CollectionPage() {
  const sb = useMemo(
    () => supabaseBrowser(),
    []
  );

  const [students, setStudents] =
    useState<Student[]>([]);

  const [years, setYears] =
    useState<AcademicYear[]>([]);

  const [heads, setHeads] =
    useState<FeeHead[]>([]);

  const [structures, setStructures] =
    useState<FeeStructure[]>([]);

  const [charges, setCharges] =
    useState<StudentCharge[]>([]);

  const [allocations, setAllocations] =
    useState<PaymentAllocation[]>(
      []
    );

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [accounts, setAccounts] =
    useState<CollectionAccount[]>(
      []
    );

  const [search, setSearch] =
    useState('');

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [selectedYear, setSelectedYear] =
    useState('');

  const [selectedMonth, setSelectedMonth] =
    useState('09');

  const [loading, setLoading] =
    useState(true);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [collecting, setCollecting] =
    useState(false);

  const [generatingNextBill, setGeneratingNextBill] =
    useState(false);

  const [amountReceived, setAmountReceived] =
    useState('');

  const [paymentMode, setPaymentMode] =
    useState<'cash' | 'upi'>(
      'cash'
    );

  const [collectionAccountId, setCollectionAccountId] =
    useState('');

  const [collectorName, setCollectorName] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [lastReceipt, setLastReceipt] =
    useState<LastReceipt | null>(
      null
    );

  const selectedYearData =
    years.find(
      (year) =>
        year.id === selectedYear
    );

  /*
   * LOAD EVERYTHING
   */
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
      accountsResult,
      structuresResult,
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
        .eq(
          'student_status',
          'active'
        )
        .order(
          'admission_no',
          {
            ascending: true,
          }
        ),

      sb
        .from('academic_years')
        .select('*')
        .order(
          'start_date',
          {
            ascending: false,
          }
        ),

      sb
        .from('fee_heads')
        .select(`
          id,
          name,
          category,
          is_recurring
        `)
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
          period_month,
          due_date,
          amount,
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
          collection_account_id,
          collector_name,
          notes
        `)
        .order(
          'paid_at',
          {
            ascending: false,
          }
        ),

      sb
        .from('payment_allocations')
        .select(`
          id,
          payment_id,
          student_charge_id,
          amount
        `),

      sb
        .from('collection_accounts')
        .select(`
          id,
          name,
          account_type,
          active
        `)
        .eq(
          'active',
          true
        )
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
          active,
          fee_heads (
            id,
            name,
            category,
            is_recurring
          )
        `)
        .eq(
          'active',
          true
        ),
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

    if (structuresResult.error) {
      setError(
        `Fee structures: ${structuresResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setStudents(
      studentsResult.data || []
    );

    setYears(
      (yearsResult.data ||
        []) as AcademicYear[]
    );

    setHeads(
      (headsResult.data ||
        []) as FeeHead[]
    );

    setCharges(
      (chargesResult.data ||
        []) as StudentCharge[]
    );

    setPayments(
      (paymentsResult.data ||
        []) as Payment[]
    );

    setAllocations(
      (allocationsResult.data ||
        []) as PaymentAllocation[]
    );

    setAccounts(
      (accountsResult.data ||
        []) as CollectionAccount[]
    );

    const normalizedStructures =
      (
        structuresResult.data ||
        []
      ).map(
        (structure) => ({
          ...structure,
          fee_heads:
            Array.isArray(
              structure.fee_heads
            )
              ? structure
                  .fee_heads[0] ||
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

    if (activeYear) {
      setSelectedYear(
        activeYear.id
      );
    }

    const defaultAccount =
      (accountsResult.data ||
        [])[0];

    if (defaultAccount) {
      setCollectionAccountId(
        defaultAccount.id
      );

      setCollectorName(
        defaultAccount.name
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  /*
   * STUDENT SEARCH
   */
  const filteredStudents =
    students
      .filter(
        (student) => {
          const q =
            search
              .toLowerCase()
              .trim();

          if (!q) {
            return false;
          }

          return (
            student.name
              .toLowerCase()
              .includes(q) ||
            student.admission_no
              .toLowerCase()
              .includes(q) ||
            (
              student.parent_phone ||
              ''
            ).includes(q) ||
            student.class_name
              .toLowerCase()
              .includes(q)
          );
        }
      )
      .slice(0, 10);

  /*
   * SELECT STUDENT
   */
  function selectStudent(
    student: Student
  ) {
    setSelectedStudent(
      student
    );

    setSearch(
      `${student.admission_no} — ${student.name}`
    );

    setMessage('');
    setError('');
    setLastReceipt(null);
  }

  /*
   * PAYMENT AGAINST A CHARGE
   */
  function paidAgainstCharge(
    chargeId: string
  ) {
    return allocations
      .filter(
        (allocation) =>
          allocation.student_charge_id ===
          chargeId
      )
      .reduce(
        (sum, allocation) =>
          sum +
          Number(
            allocation.amount ||
              0
          ),
        0
      );
  }

  /*
   * ALL CHARGES FOR SELECTED STUDENT
   */
  const studentCharges =
    selectedStudent
      ? charges
          .filter(
            (charge) =>
              charge.student_id ===
                selectedStudent.id &&
              (
                !selectedYear ||
                charge.academic_year_id ===
                  selectedYear
              )
          )
          .map(
            (charge) => {
              const paid =
                paidAgainstCharge(
                  charge.id
                );

              return {
                ...charge,
                paid,
                balance:
                  Math.max(
                    0,
                    Number(
                      charge.amount
                    ) - paid
                  ),
              };
            }
          )
      : [];

  /*
   * CURRENT MONTH
   */
  const selectedMonthDate =
    selectedYearData
      ? getPeriodDate(
          selectedYearData,
          selectedMonth
        )
      : '';

  const selectedMonthCharges =
    studentCharges.filter(
      (charge) =>
        charge.period_month ===
        selectedMonthDate
    );

  const selectedMonthOutstanding =
    selectedMonthCharges.reduce(
      (sum, charge) =>
        sum + charge.balance,
      0
    );

  const selectedMonthTotal =
    selectedMonthCharges.reduce(
      (sum, charge) =>
        sum +
        Number(
          charge.amount || 0
        ),
      0
    );

  const selectedMonthPaid =
    selectedMonthCharges.reduce(
      (sum, charge) =>
        sum + charge.paid,
      0
    );

  /*
   * ALL OUTSTANDING FOR SESSION
   *
   * Oldest first.
   */
  const outstandingCharges =
    studentCharges
      .filter(
        (charge) =>
          charge.balance > 0
      )
      .sort(
        (a, b) => {
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
        }
      );

  const totalOutstanding =
    outstandingCharges.reduce(
      (sum, charge) =>
        sum + charge.balance,
      0
    );

  /*
   * NEXT MONTH
   */
  const nextMonth =
    selectedYearData
      ? getNextMonth(
          selectedYearData,
          selectedMonth
        )
      : '';

  const nextMonthDate =
    selectedYearData
      ? getPeriodDate(
          selectedYearData,
          nextMonth
        )
      : '';

  const nextMonthExistingCharges =
    studentCharges.filter(
      (charge) =>
        charge.period_month ===
        nextMonthDate
    );

  const nextMonthExistingTotal =
    nextMonthExistingCharges.reduce(
      (sum, charge) =>
        sum +
        Number(
          charge.amount || 0
        ),
      0
    );

  /*
   * FEE STRUCTURES FOR SELECTED YEAR
   */
  const yearStructures =
    structures.filter(
      (structure) =>
        structure.academic_year_id ===
        selectedYear
    );

  /*
   * FIND SCHOOL FEE
   */
  function findSchoolStructure() {
    if (!selectedStudent) {
      return null;
    }

    return (
      yearStructures.find(
        (structure) =>
          isSchoolFee(
            structure
          ) &&
          normalise(
            structure.class_name
          ) ===
            normalise(
              selectedStudent.class_name
            ) &&
          (
            structure.frequency ===
              'Monthly' ||
            structure.frequency ===
              'monthly'
          )
      ) || null
    );
  }

  /*
   * FIND HOSTEL FEE
   */
  function findHostelStructure() {
    return (
      yearStructures.find(
        (structure) =>
          isHostelFee(
            structure
          ) &&
          (
            structure.frequency ===
              'Monthly' ||
            structure.frequency ===
              'monthly'
          )
      ) || null
    );
  }

  /*
   * FIND VEHICLE FEE
   */
  function findVehicleStructure() {
    if (
      !selectedStudent ||
      !selectedStudent.vehicle_required ||
      !selectedStudent.vehicle_area
    ) {
      return null;
    }

    const studentArea =
      normalise(
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

          if (
            structure.frequency !==
              'Monthly' &&
            structure.frequency !==
              'monthly'
          ) {
            return false;
          }

          const configuredArea =
            normalise(
              structure.vehicle_area
            );

          if (
            !configuredArea
          ) {
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

  /*
   * CALCULATE NEXT BILL
   */
  const nextBillItems: ReceiptItem[] =
    [];

  const nextSchool =
    findSchoolStructure();

  const nextHostel =
    findHostelStructure();

  const nextVehicle =
    findVehicleStructure();

  if (
    nextSchool &&
    nextSchool.amount !==
      null &&
    nextSchool.pricing_type !==
      'actual'
  ) {
    nextBillItems.push({
      name:
        `School Fee — ${
          selectedStudent?.class_name ||
          ''
        }`,
      amount:
        Number(
          nextSchool.amount
        ),
    });
  }

  if (
    selectedStudent?.hostel_required &&
    nextHostel &&
    nextHostel.amount !==
      null &&
    nextHostel.pricing_type !==
      'actual'
  ) {
    nextBillItems.push({
      name: 'Hostel Fee',
      amount:
        Number(
          nextHostel.amount
        ),
    });
  }

  if (
    selectedStudent?.vehicle_required &&
    nextVehicle &&
    nextVehicle.amount !==
      null &&
    nextVehicle.pricing_type !==
      'actual'
  ) {
    nextBillItems.push({
      name:
        `Vehicle Fee — ${
          selectedStudent.vehicle_area ||
          ''
        }`,
      amount:
        Number(
          nextVehicle.amount
        ),
    });
  }

  const calculatedNextBillTotal =
    nextBillItems.reduce(
      (sum, item) =>
        sum + item.amount,
      0
    );

  const nextBillAlreadyExists =
    nextMonthExistingCharges.length >
    0;

  const nextBillOutstanding =
    nextMonthExistingCharges.reduce(
      (sum, charge) =>
        sum + charge.balance,
      0
    );

  /*
   * GENERATE NEXT MONTH CHARGES
   */
  async function generateNextBill() {
    if (
      !selectedStudent ||
      !selectedYearData
    ) {
      return;
    }

    if (
      nextBillAlreadyExists
    ) {
      setMessage(
        `${getMonthLabel(
          nextMonth
        )} bill already exists.`
      );
      return;
    }

    if (
      nextBillItems.length ===
      0
    ) {
      setError(
        'Next bill cannot be generated because the student has no complete monthly fee structure configured.'
      );
      return;
    }

    /*
     * Check whether any required
     * component is missing.
     */
    if (
      !nextSchool
    ) {
      setError(
        `No monthly school fee configured for ${selectedStudent.class_name}.`
      );
      return;
    }

    if (
      selectedStudent.hostel_required &&
      !nextHostel
    ) {
      setError(
        'Student is a hosteller but no monthly hostel fee is configured.'
      );
      return;
    }

    if (
      selectedStudent.vehicle_required &&
      !nextVehicle
    ) {
      setError(
        `No vehicle fee found for route/area "${selectedStudent.vehicle_area || 'not selected'}".`
      );
      return;
    }

    setGeneratingNextBill(
      true
    );
    setError('');
    setMessage('');

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

    if (
      nextSchool &&
      nextSchool.fee_head_id &&
      nextSchool.amount !==
        null &&
      nextSchool.pricing_type !==
        'actual'
    ) {
      rows.push({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear,

        fee_head_id:
          nextSchool.fee_head_id,

        charge_name:
          `School Fee — ${selectedStudent.class_name}`,

        charge_type:
          'monthly',

        period_month:
          nextMonthDate,

        due_date:
          nextMonthDate,

        amount:
          Number(
            nextSchool.amount
          ),

        notes:
          `Generated from ${selectedYearData.name} fee structure.`,
      });
    }

    if (
      selectedStudent.hostel_required &&
      nextHostel &&
      nextHostel.fee_head_id &&
      nextHostel.amount !==
        null &&
      nextHostel.pricing_type !==
        'actual'
    ) {
      rows.push({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear,

        fee_head_id:
          nextHostel.fee_head_id,

        charge_name:
          'Hostel Fee',

        charge_type:
          'monthly',

        period_month:
          nextMonthDate,

        due_date:
          nextMonthDate,

        amount:
          Number(
            nextHostel.amount
          ),

        notes:
          'Generated because student is marked as hosteller.',
      });
    }

    if (
      selectedStudent.vehicle_required &&
      nextVehicle &&
      nextVehicle.fee_head_id &&
      nextVehicle.amount !==
        null &&
      nextVehicle.pricing_type !==
        'actual'
    ) {
      rows.push({
        student_id:
          selectedStudent.id,

        academic_year_id:
          selectedYear,

        fee_head_id:
          nextVehicle.fee_head_id,

        charge_name:
          `Vehicle Fee — ${
            selectedStudent.vehicle_area ||
            nextVehicle.vehicle_area ||
            'Route'
          }`,

        charge_type:
          'monthly',

        period_month:
          nextMonthDate,

        due_date:
          nextMonthDate,

        amount:
          Number(
            nextVehicle.amount
          ),

        notes:
          'Generated from vehicle route fee structure.',
      });
    }

    if (
      rows.length ===
      0
    ) {
      setError(
        'No bill components could be generated.'
      );
      setGeneratingNextBill(
        false
      );
      return;
    }

    const {
      error: insertError,
    } = await sb
      .from('student_charges')
      .insert(rows);

    if (insertError) {
      setError(
        `Could not generate next bill: ${insertError.message}`
      );

      setGeneratingNextBill(
        false
      );
      return;
    }

    setMessage(
      `${getMonthLabel(
        nextMonth
      )} bill generated successfully.`
    );

    await loadInitialData();

    setGeneratingNextBill(
      false
    );
  }

  /*
   * ALLOCATION PREVIEW
   *
   * Oldest dues first.
   */
  const enteredAmount =
    Number(
      amountReceived || 0
    );

  const allocationPreview =
    outstandingCharges.map(
      (charge) => {
        const alreadyAllocated =
          outstandingCharges
            .slice(
              0,
              outstandingCharges.indexOf(
                charge
              )
            )
            .reduce(
              (
                sum,
                previous
              ) =>
                sum +
                Math.min(
                  previous.balance,
                  Math.max(
                    0,
                    enteredAmount -
                      sum
                  )
                ),
              0
            );

        const remaining =
          Math.max(
            0,
            enteredAmount -
              alreadyAllocated
          );

        const allocation =
          Math.min(
            charge.balance,
            remaining
          );

        return {
          ...charge,
          allocation,
        };
      }
    );

  const allocationTotal =
    allocationPreview.reduce(
      (sum, item) =>
        sum + item.allocation,
      0
    );

  /*
   * RECORD PAYMENT
   */
  async function recordPayment() {
    if (
      !selectedStudent
    ) {
      setError(
        'Select a student first.'
      );
      return;
    }

    const amount =
      Number(
        amountReceived
      );

    if (
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      setError(
        'Enter a valid payment amount.'
      );
      return;
    }

    if (
      totalOutstanding <=
      0
    ) {
      setError(
        'There is no outstanding bill to collect. Use the Next Bill section below.'
      );
      return;
    }

    if (
      amount >
      totalOutstanding
    ) {
      setError(
        `Payment cannot exceed the total outstanding amount of ₹${totalOutstanding.toLocaleString(
          'en-IN'
        )}.`
      );
      return;
    }

    if (
      allocationTotal <=
      0
    ) {
      setError(
        'No outstanding charge could be allocated.'
      );
      return;
    }

    setCollecting(true);
    setError('');
    setMessage('');
    setLastReceipt(null);

    /*
     * Create ONE payment.
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
          selectedYear ||
          null,

        amount,

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

      setCollecting(false);
      return;
    }

    /*
     * Allocate payment oldest-first.
     */
    const allocationRows =
      allocationPreview
        .filter(
          (item) =>
            item.allocation >
            0
        )
        .map(
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
      .from(
        'payment_allocations'
      )
      .insert(
        allocationRows
      );

    if (
      allocationError
    ) {
      /*
       * Roll back the payment
       * if allocations fail.
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
      allocationPreview
        .filter(
          (item) =>
            item.allocation >
            0
        )
        .map(
          (item) => ({
            name:
              item.charge_name ||
              feeHeadName(
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

    setLastReceipt({
      receiptNo:
        payment.receipt_no ||
        `RCPT-${payment.id
          .slice(
            0,
            8
          )
          .toUpperCase()}`,

      student:
        selectedStudent,

      amount,

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
      `₹${amount.toLocaleString(
        'en-IN'
      )} received successfully.`
    );

    await loadInitialData();

    setCollecting(false);
  }

  /*
   * PAY NEXT BILL
   *
   * If next bill does not exist:
   * 1. Generate it
   * 2. Refresh charges
   * 3. Pay it
   */
  async function generateAndPayNextBill() {
    if (
      !selectedStudent ||
      !selectedYearData
    ) {
      return;
    }

    setGeneratingNextBill(
      true
    );

    setError('');
    setMessage('');

    /*
     * If next bill doesn't exist,
     * create it first.
     */
    if (
      !nextBillAlreadyExists
    ) {
      if (
        calculatedNextBillTotal <=
        0
      ) {
        setError(
          'Next bill amount is ₹0. Check the student's class, hostel status and vehicle route.'
        );

        setGeneratingNextBill(
          false
        );

        return;
      }

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

      if (
        nextSchool &&
        nextSchool.fee_head_id &&
        nextSchool.amount !==
          null &&
        nextSchool.pricing_type !==
          'actual'
      ) {
        rows.push({
          student_id:
            selectedStudent.id,

          academic_year_id:
            selectedYear,

          fee_head_id:
            nextSchool.fee_head_id,

          charge_name:
            `School Fee — ${selectedStudent.class_name}`,

          charge_type:
            'monthly',

          period_month:
            nextMonthDate,

          due_date:
            nextMonthDate,

          amount:
            Number(
              nextSchool.amount
            ),

          notes:
            `Generated from ${selectedYearData.name} fee structure.`,
        });
      }

      if (
        selectedStudent.hostel_required &&
        nextHostel &&
        nextHostel.fee_head_id &&
        nextHostel.amount !==
          null &&
        nextHostel.pricing_type !==
          'actual'
      ) {
        rows.push({
          student_id:
            selectedStudent.id,

          academic_year_id:
            selectedYear,

          fee_head_id:
            nextHostel.fee_head_id,

          charge_name:
            'Hostel Fee',

          charge_type:
            'monthly',

          period_month:
            nextMonthDate,

          due_date:
            nextMonthDate,

          amount:
            Number(
              nextHostel.amount
            ),

          notes:
            'Generated because student is marked as hosteller.',
        });
      }

      if (
        selectedStudent.vehicle_required &&
        nextVehicle &&
        nextVehicle.fee_head_id &&
        nextVehicle.amount !==
          null &&
        nextVehicle.pricing_type !==
          'actual'
      ) {
        rows.push({
          student_id:
            selectedStudent.id,

          academic_year_id:
            selectedYear,

          fee_head_id:
            nextVehicle.fee_head_id,

          charge_name:
            `Vehicle Fee — ${
              selectedStudent.vehicle_area ||
              nextVehicle.vehicle_area ||
              'Route'
            }`,

          charge_type:
            'monthly',

          period_month:
            nextMonthDate,

          due_date:
            nextMonthDate,

          amount:
            Number(
              nextVehicle.amount
            ),

          notes:
            'Generated from vehicle route fee structure.',
        });
      }

      if (
        rows.length ===
        0
      ) {
        setError(
          'Could not create the next bill. Fee structure is incomplete.'
        );

        setGeneratingNextBill(
          false
        );

        return;
      }

      const {
        error: insertError,
      } = await sb
        .from(
          'student_charges'
        )
        .insert(rows);

      if (
        insertError
      ) {
        setError(
          `Next bill generation failed: ${insertError.message}`
        );

        setGeneratingNextBill(
          false
        );

        return;
      }

      await loadInitialData();
    }

    setGeneratingNextBill(
      false
    );

    /*
     * After generation the component
     * state will refresh. The user can
     * then enter the amount and pay.
     */
    setMessage(
      `${getMonthLabel(
        nextMonth
      )} bill is ready. Enter the amount below to collect payment.`
    );
  }

  /*
   * PRINT RECEIPT
   */
  function printReceipt() {
    if (
      !lastReceipt
    ) {
      return;
    }

    const printWindow =
      window.open(
        '',
        '_blank'
      );

    if (
      !printWindow
    ) {
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
              <td style="padding:10px 0;border-bottom:1px solid #eee;">
                ${escapeHtml(
                  item.name
                )}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">
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
          <title>${escapeHtml(
            lastReceipt.receiptNo
          )}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 30px;
              color: #111827;
              background: white;
            }

            .receipt {
              max-width: 720px;
              margin: auto;
              border: 1px solid #d1d5db;
              padding: 35px;
            }

            .school {
              text-align: center;
              font-size: 26px;
              font-weight: 800;
              margin-bottom: 5px;
            }

            .subtitle {
              text-align: center;
              color: #64748b;
              margin-bottom: 25px;
            }

            .title {
              text-align: center;
              font-size: 20px;
              font-weight: 800;
              margin-bottom: 25px;
            }

            .info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px 25px;
              margin-bottom: 25px;
            }

            .label {
              color: #64748b;
              font-size: 12px;
            }

            .value {
              font-weight: 700;
              margin-top: 3px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            .total {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 2px solid #111827;
              display: flex;
              justify-content: space-between;
              font-size: 20px;
              font-weight: 800;
            }

            .footer {
              margin-top: 35px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
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
                    lastReceipt.receiptNo
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Date
                </div>

                <div class="value">
                  ${new Date(
                    lastReceipt.date
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
                    lastReceipt.student.name
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Admission No.
                </div>

                <div class="value">
                  ${escapeHtml(
                    lastReceipt.student.admission_no
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Class
                </div>

                <div class="value">
                  ${escapeHtml(
                    `${lastReceipt.student.class_name}-${lastReceipt.student.section}`
                  )}
                </div>
              </div>

              <div>
                <div class="label">
                  Payment Mode
                </div>

                <div class="value">
                  ${escapeHtml(
                    lastReceipt.mode.toUpperCase()
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
                ₹${lastReceipt.amount.toLocaleString(
                  'en-IN'
                )}
              </span>
            </div>

            <div style="margin-top:20px;">
              <div class="label">
                Collected By
              </div>

              <div class="value">
                ${escapeHtml(
                  lastReceipt.collector
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

    printWindow.document.close();
  }

  /*
   * ESCAPE HTML FOR RECEIPT
   */
  function escapeHtml(
    value: string
  ) {
    return value
      .replaceAll(
        '&',
        '&amp;'
      )
      .replaceAll(
        '<',
        '&lt;'
      )
      .replaceAll(
        '>',
        '&gt;'
      )
      .replaceAll(
        '"',
        '&quot;'
      )
      .replaceAll(
        "'",
        '&#039;'
      );
  }

  if (loading) {
    return (
      <main className="main">
        <div
          className="card"
          style={{
            maxWidth: 900,
            margin: '40px auto',
          }}
        >
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
              CASH / UPI COLLECTION
            </p>

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
            {message}
          </div>
        )}

        {/* STEP 1 */}

        <section className="card">

          <div
            style={{
              marginBottom: 18,
            }}
          >

            <h2>
              1. Select Student
            </h2>

            <p className="muted">
              Search by admission number, student name, class or parent phone.
            </p>

          </div>

          <div
            style={{
              position:
                'relative',
            }}
          >

            <input
              className="input"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                setSelectedStudent(
                  null
                );
              }}
              placeholder="Search admission no., student name, class or phone..."
              autoComplete="off"
            />

            {search.trim() &&
              !selectedStudent &&
              filteredStudents.length >
                0 && (

                <div
                  style={{
                    position:
                      'absolute',
                    top:
                      'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background:
                      '#fff',
                    border:
                      '1px solid #dfe5ef',
                    borderRadius:
                      12,
                    boxShadow:
                      '0 15px 35px rgba(16,24,40,.12)',
                    overflow:
                      'hidden',
                  }}
                >

                  {filteredStudents.map(
                    (student) => (

                      <button
                        type="button"
                        key={
                          student.id
                        }
                        onClick={() =>
                          selectStudent(
                            student
                          )
                        }
                        style={{
                          width:
                            '100%',
                          textAlign:
                            'left',
                          padding:
                            '13px 15px',
                          border: 0,
                          borderBottom:
                            '1px solid #eef1f5',
                          background:
                            '#fff',
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

                        {student.name}

                        <div
                          style={{
                            fontSize:
                              12,
                            color:
                              '#667085',
                            marginTop:
                              3,
                          }}
                        >
                          {
                            student.class_name
                          }
                          -
                          {
                            student.section
                          }
                          {' · '}
                          Parent:{' '}
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

          </div>

        </section>

        {/* SELECTED STUDENT */}

        {selectedStudent && (
          <>

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
                      marginTop:
                        5,
                    }}
                  >
                    {
                      selectedStudent.name
                    }
                  </h2>

                  <p className="muted">
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
                      marginTop:
                        4,
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
                    gap: 10,
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

            {/* STEP 2 */}

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
                Choose the academic session and month to review dues.
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
                    ) =>
                      setSelectedYear(
                        event.target
                          .value
                      )
                    }
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
                    ) =>
                      setSelectedMonth(
                        event.target
                          .value
                      )
                    }
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
                            month.label
                          }{' '}
                          {
                            selectedYearData?.start_date &&
                            Number(
                              month.value
                            ) >= 4
                              ? selectedYearData.start_date.slice(
                                  0,
                                  4
                                )
                              : selectedYearData?.start_date
                              ? String(
                                  Number(
                                    selectedYearData.start_date.slice(
                                      0,
                                      4
                                    )
                                  ) + 1
                                )
                              : ''
                          }
                        </option>
                      )
                    )}
                  </select>

                </label>

              </div>

            </section>

            {/* CURRENT MONTH STATUS */}

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
                  alignItems:
                    'center',
                  gap: 20,
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <h2>
                    3.{' '}
                    {getMonthLabel(
                      selectedMonth
                    )}{' '}
                    Bill
                  </h2>

                  <p className="muted">
                    Current selected-month billing status.
                  </p>

                </div>

                <div
                  style={{
                    textAlign:
                      'right',
                  }}
                >

                  <div className="metric-label">
                    CURRENT MONTH OUTSTANDING
                  </div>

                  <div
                    style={{
                      fontSize:
                        30,
                      fontWeight:
                        800,
                      color:
                        selectedMonthOutstanding >
                        0
                          ? '#b42318'
                          : '#067647',
                    }}
                  >
                    ₹
                    {selectedMonthOutstanding.toLocaleString(
                      'en-IN'
                    )}
                  </div>

                </div>

              </div>

              {selectedMonthCharges.length >
                0 ? (

                <div
                  className="table-wrap"
                  style={{
                    marginTop:
                      18,
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

                      {selectedMonthCharges.map(
                        (charge) => (
                          <tr
                            key={
                              charge.id
                            }
                          >

                            <td>
                              <strong>
                                {
                                  charge.charge_name ||
                                  feeHeadName(
                                    heads.find(
                                      (
                                        head
                                      ) =>
                                        head.id ===
                                        charge.fee_head_id
                                    ) ||
                                      null
                                  )
                                }
                              </strong>
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
                              {charge.paid.toLocaleString(
                                'en-IN'
                              )}
                            </td>

                            <td>

                              {charge.balance >
                              0 ? (

                                <span className="badge red">
                                  ₹
                                  {charge.balance.toLocaleString(
                                    'en-IN'
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
                    marginTop:
                      18,
                    border:
                      '1px solid #e7ebf2',
                    borderRadius:
                      14,
                  }}
                >
                  No bill has been generated for this month yet.
                </div>

              )}

              {selectedMonthCharges.length >
                0 &&
                selectedMonthOutstanding ===
                  0 && (

                  <div
                    className="success"
                    style={{
                      marginTop:
                        16,
                    }}
                  >
                    ✓{' '}
                    <strong>
                      {
                        getMonthLabel(
                          selectedMonth
                        )
                      }{' '}
                      bill is fully paid.
                    </strong>{' '}
                    You can proceed to the next bill below.
                  </div>

                )}

            </section>

            {/* OUTSTANDING */}

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
                  alignItems:
                    'center',
                  gap: 20,
                  flexWrap:
                    'wrap',
                }}
              >

                <div>

                  <h2>
                    4. Outstanding Fees
                  </h2>

                  <p className="muted">
                    Oldest outstanding charges are allocated first.
                  </p>

                </div>

                <div
                  style={{
                    background:
                      '#111827',
                    color:
                      '#fff',
                    borderRadius:
                      16,
                    padding:
                      '18px 22px',
                    minWidth:
                      230,
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
                    ₹
                    {totalOutstanding.toLocaleString(
                      'en-IN'
                    )}
                  </div>

                </div>

              </div>

              {outstandingCharges.length >
              0 ? (

                <div
                  className="table-wrap"
                  style={{
                    marginTop:
                      18,
                  }}
                >

                  <table className="table">

                    <thead>
                      <tr>
                        <th>
                          Due
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
                          Balance
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
                              <strong>
                                {
                                  charge.charge_name ||
                                  feeHeadName(
                                    heads.find(
                                      (
                                        head
                                      ) =>
                                        head.id ===
                                        charge.fee_head_id
                                    ) ||
                                      null
                                  )
                                }
                              </strong>
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
                              {charge.paid.toLocaleString(
                                'en-IN'
                              )}
                            </td>

                            <td>
                              <span className="badge red">
                                ₹
                                {charge.balance.toLocaleString(
                                  'en-IN'
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
                    marginTop:
                      18,
                  }}
                >
                  ✓ No outstanding dues for this academic session.
                </div>

              )}

            </section>

            {/* PAYMENT */}

            {totalOutstanding >
              0 && (

              <section
                className="card"
                style={{
                  marginTop:
                    18,
                }}
              >

                <h2>
                  5. Receive Payment
                </h2>

                <p className="muted">
                  Payment is automatically applied to the oldest dues first.
                </p>

                <div
                  className="grid2"
                  style={{
                    marginTop:
                      18,
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
                      placeholder="Enter amount"
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
                          event
                            .target
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

                        if (
                          account
                        ) {
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
                        (
                          account
                        ) => (
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
                      placeholder="Principal / Vice Principal / Director / custom"
                    />

                  </label>

                </div>

                <label
                  className="label"
                  style={{
                    marginTop:
                      16,
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

                {/* ALLOCATION PREVIEW */}

                {enteredAmount >
                  0 && (

                  <div
                    style={{
                      marginTop:
                        18,
                    }}
                  >

                    <h3>
                      Allocation Preview
                    </h3>

                    <div
                      className="table-wrap"
                      style={{
                        marginTop:
                          10,
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

                          {allocationPreview
                            .filter(
                              (
                                item
                              ) =>
                                item.allocation >
                                0
                            )
                            .map(
                              (
                                item
                              ) => (
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
                                    ₹
                                    {item.balance.toLocaleString(
                                      'en-IN'
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      ₹
                                      {item.allocation.toLocaleString(
                                        'en-IN'
                                      )}
                                    </strong>
                                  </td>

                                </tr>
                              )
                            )}

                        </tbody>

                      </table>

                    </div>

                    <div
                      className="card"
                      style={{
                        marginTop:
                          12,
                        background:
                          '#eff6ff',
                        borderColor:
                          '#bfdbfe',
                      }}
                    >
                      Payment allocation:{' '}
                      <strong>
                        ₹
                        {allocationTotal.toLocaleString(
                          'en-IN'
                        )}
                      </strong>
                    </div>

                  </div>

                )}

                <button
                  type="button"
                  className="btn"
                  disabled={
                    collecting ||
                    enteredAmount <=
                      0 ||
                    enteredAmount >
                      totalOutstanding
                  }
                  onClick={
                    recordPayment
                  }
                  style={{
                    marginTop:
                      18,
                    padding:
                      '13px 22px',
                  }}
                >
                  {collecting
                    ? 'Recording Payment...'
                    : `Receive ₹${enteredAmount > 0 ? enteredAmount.toLocaleString('en-IN') : '0'}`}
                </button>

              </section>

            )}

            {/* NEXT BILL */}

            {totalOutstanding ===
              0 && (

              <section
                className="card"
                style={{
                  marginTop:
                    18,
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
                    alignItems:
                      'center',
                    gap: 20,
                    flexWrap:
                      'wrap',
                  }}
                >

                  <div>

                    <p
                      style={{
                        margin: 0,
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
                    </p>

                    <h2
                      style={{
                        marginTop:
                          5,
                      }}
                    >
                      {getMonthLabel(
                        nextMonth
                      )}{' '}
                      {selectedYearData?.start_date &&
                      Number(
                        nextMonth
                      ) >= 4
                        ? selectedYearData.start_date.slice(
                            0,
                            4
                          )
                        : selectedYearData?.start_date
                        ? String(
                            Number(
                              selectedYearData.start_date.slice(
                                0,
                                4
                              )
                            ) + 1
                          )
                        : ''}
                    </h2>

                    <p className="muted">
                      {nextBillAlreadyExists
                        ? 'The next bill has already been generated.'
                        : 'The next bill will be calculated from the student fee structure.'}
                    </p>

                  </div>

                  <div
                    style={{
                      textAlign:
                        'right',
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
                      }}
                    >
                      ₹
                      {(
                        nextBillAlreadyExists
                          ? nextMonthExistingTotal
                          : calculatedNextBillTotal
                      ).toLocaleString(
                        'en-IN'
                      )}
                    </div>

                  </div>

                </div>

                {nextBillItems.length >
                  0 && (

                  <div
                    className="table-wrap"
                    style={{
                      marginTop:
                        18,
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
                          (
                            item
                          ) => (
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
                                  ₹
                                  {item.amount.toLocaleString(
                                    'en-IN'
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

                {nextBillAlreadyExists &&
                  nextBillOutstanding ===
                    0 && (

                    <div
                      className="success"
                      style={{
                        marginTop:
                          16,
                      }}
                    >
                      ✓{' '}
                      {getMonthLabel(
                        nextMonth
                      )}{' '}
                      bill is already fully paid.
                    </div>

                  )}

                {nextBillAlreadyExists &&
                  nextBillOutstanding >
                    0 && (

                    <div
                      className="card"
                      style={{
                        marginTop:
                          16,
                        background:
                          '#fffbeb',
                        borderColor:
                          '#fcd34d',
                      }}
                    >
                      <strong>
                        ₹
                        {nextBillOutstanding.toLocaleString(
                          'en-IN'
                        )}
                      </strong>{' '}
                      remains outstanding on the next bill.
                    </div>

                  )}

                {!nextBillAlreadyExists && (
                  <button
                    type="button"
                    className="btn"
                    onClick={
                      generateNextBill
                    }
                    disabled={
                      generatingNextBill
                    }
                    style={{
                      marginTop:
                        18,
                    }}
                  >
                    {generatingNextBill
                      ? 'Generating...'
                      : `Generate ${getMonthLabel(
                          nextMonth
                        )} Bill`}
                  </button>
                )}

                {nextBillAlreadyExists &&
                  nextBillOutstanding >
                    0 && (

                    <div
                      style={{
                        marginTop:
                          18,
                        padding:
                          18,
                        border:
                          '1px solid #e7ebf2',
                        borderRadius:
                          14,
                      }}
                    >

                      <h3>
                        Pay Next Bill
                      </h3>

                      <p className="muted">
                        Enter the amount to collect against the generated next bill.
                      </p>

                      <div
                        className="grid2"
                        style={{
                          marginTop:
                            14,
                        }}
                      >

                        <label className="label">
                          Amount

                          <input
                            className="input"
                            type="number"
                            min="1"
                            max={
                              nextBillOutstanding
                            }
                            value={
                              amountReceived
                            }
                            onChange={(
                              event
                            ) =>
                              setAmountReceived(
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Enter amount"
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
                                event
                                  .target
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
                          marginTop:
                            14,
                        }}
                        disabled={
                          collecting ||
                          Number(
                            amountReceived
                          ) <=
                            0 ||
                          Number(
                            amountReceived
                          ) >
                            nextBillOutstanding
                        }
                        onClick={
                          recordPayment
                        }
                      >
                        {collecting
                          ? 'Processing...'
                          : `Pay Next Bill ₹${Number(amountReceived || 0).toLocaleString('en-IN')}`}
                      </button>

                    </div>

                  )}

              </section>

            )}

            {/* RECEIPT */}

            {lastReceipt && (

              <section
                className="card"
                style={{
                  marginTop:
                    18,
                  marginBottom:
                    30,
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

                    <p
                      style={{
                        margin: 0,
                        color:
                          '#067647',
                        fontSize:
                          12,
                        fontWeight:
                          800,
                      }}
                    >
                      PAYMENT SUCCESSFUL
                    </p>

                    <h2>
                      Receipt{' '}
                      {
                        lastReceipt.receiptNo
                      }
                    </h2>

                    <p className="muted">
                      ₹
                      {lastReceipt.amount.toLocaleString(
                        'en-IN'
                      )}{' '}
                      received from{' '}
                      {
                        lastReceipt.student.name
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
