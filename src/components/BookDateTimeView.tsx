import React, { useMemo, useState, useEffect } from 'react';
import { AtelierShell } from './AtelierShell';
import { useAtelier } from '../store/AtelierContext';
import { Accoutrement, Service } from '../types';
import { PriceSummary } from './booking/PriceSummary';
import {
  addMinutes,
  generateUpcomingDays,
  checkSlotAvailability,
  findClosestAvailableSlotByGaps,
  calculateScheduleGaps,
  TIME_SLOTS,
  calculateBookingTotals,
  isSlotExpired,
  areAllSlotsExpiredForDay,
} from '../utils/bookingUtils';
import { toPersianDigits } from '../utils/dateUtils';
import { hapticLight, hapticSelection, hapticWarning } from '../utils/hapticUtils';
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Zap,
  CalendarCheck,
  Hourglass,
  Layers,
} from 'lucide-react';

interface BookDateTimeViewProps {
  service: Service | null;
  selectedDay: number;
  selectedTime: string;
  preferredTime?: string;
  accoutrements: Accoutrement[];
  onSelectDay: (day: number) => void;
  onSelectTime: (time: string) => void;
  onBackToPreference: () => void;
  onContinueToCheckout: () => void;
  onOpenProfile?: () => void;
}

export const BookDateTimeView: React.FC<BookDateTimeViewProps> = ({
  service,
  selectedDay,
  selectedTime,
  preferredTime = '18:00',
  accoutrements,
  onSelectDay,
  onSelectTime,
  onBackToPreference,
  onContinueToCheckout,
  onOpenProfile,
}) => {
  const { activeChair, activeBarber, appointments, currentCustomer, logHourDemand } = useAtelier();
  const days = useMemo(() => generateUpcomingDays(14), []);
  const totals = useMemo(
    () => calculateBookingTotals(service, accoutrements),
    [service, accoutrements]
  );

  const activeDay = days.find((d) => d.dayNumber === selectedDay) ?? days[0];

  // Tracks if all slots on the selected day are expired
  const isDayAllExpired = useMemo(() => areAllSlotsExpiredForDay(selectedDay), [selectedDay]);

  // Tracks if the user clicked on a booked/taken slot to show immediate feedback
  const [takenSlotAttempted, setTakenSlotAttempted] = useState<string | null>(null);
  const [expiredNoticeMessage, setExpiredNoticeMessage] = useState<string | null>(null);

  // Available free gaps between existing appointments on this day
  const scheduleGaps = useMemo(() => {
    return calculateScheduleGaps(selectedDay, totals.totalDuration, appointments);
  }, [selectedDay, totals.totalDuration, appointments]);

  // Map of availability for all slots on this day for the combined duration (service + extras)
  const slotsStatus = useMemo(() => {
    return TIME_SLOTS.map((slot) => ({
      slot,
      ...checkSlotAvailability(selectedDay, slot, totals.totalDuration, appointments),
    }));
  }, [selectedDay, totals.totalDuration, appointments]);

  // Status of the user's initially preferred time
  const preferredTimeStatus = useMemo(() => {
    return checkSlotAvailability(
      selectedDay,
      preferredTime,
      totals.totalDuration,
      appointments
    );
  }, [selectedDay, preferredTime, totals.totalDuration, appointments]);

  // Selected slot status
  const currentSlotStatus = useMemo(() => {
    if (!selectedTime) return null;
    return (
      slotsStatus.find((s) => s.slot === selectedTime) ||
      checkSlotAvailability(selectedDay, selectedTime, totals.totalDuration, appointments)
    );
  }, [slotsStatus, selectedDay, selectedTime, totals.totalDuration, appointments]);

  // Nearest available slot calculated using booking gap analysis
  const targetBookedTime = takenSlotAttempted || (!preferredTimeStatus.isAvailable ? preferredTime : null);
  const isTargetExpired = targetBookedTime ? isSlotExpired(selectedDay, targetBookedTime) : false;

  const nearestResult = useMemo(() => {
    if (!targetBookedTime) return null;
    return findClosestAvailableSlotByGaps(
      selectedDay,
      targetBookedTime,
      totals.totalDuration,
      appointments,
      TIME_SLOTS
    );
  }, [targetBookedTime, selectedDay, totals.totalDuration, appointments]);

  // Auto-highlight and auto-select closest available slot if preferred time was booked or expired
  useEffect(() => {
    const isCurrentExpired = selectedTime ? isSlotExpired(selectedDay, selectedTime) : false;
    if ((!preferredTimeStatus.isAvailable || isCurrentExpired) && nearestResult?.nearest) {
      if (selectedTime === preferredTime || !selectedTime || isCurrentExpired) {
        onSelectTime(nearestResult.nearest);
      }
    } else if (isCurrentExpired && !nearestResult?.nearest) {
      onSelectTime('');
    }
  }, [preferredTimeStatus.isAvailable, nearestResult?.nearest, selectedDay, selectedTime]);

  const endTime = useMemo(() => {
    if (!selectedTime) return '';
    return addMinutes(selectedTime, totals.totalDuration);
  }, [selectedTime, totals.totalDuration]);

  if (!service) return null;

  const handleSlotClick = (slot: string, isAvailable: boolean, isExpired?: boolean) => {
    if (isExpired) {
      hapticWarning();
      setExpiredNoticeMessage(`ساعت ${toPersianDigits(slot)} سپری شده است و امکان رزرو ندارد.`);
      setTakenSlotAttempted(null);
      return;
    }

    setExpiredNoticeMessage(null);
    if (isAvailable) {
      hapticSelection();
    } else {
      hapticWarning();
    }

    // Log slot request into application demand state
    logHourDemand({
      dayNumber: selectedDay,
      requestedTime: slot,
      serviceId: service.id,
      serviceName: service.name,
      weekday: activeDay.weekday,
      dateLabel: activeDay.label,
      customerName: currentCustomer?.name || 'مشتری محترم',
      customerPhone: currentCustomer?.phone || '',
      wasReserved: isAvailable,
    });

    if (!isAvailable) {
      // User clicked a booked slot: show notice and auto-select & highlight nearest available gap block
      setTakenSlotAttempted(slot);
      const res = findClosestAvailableSlotByGaps(
        selectedDay,
        slot,
        totals.totalDuration,
        appointments,
        TIME_SLOTS
      );
      if (res.nearest) {
        onSelectTime(res.nearest);
      }
    } else {
      // Available slot clicked
      setTakenSlotAttempted(null);
      onSelectTime(slot);
    }
  };

  // Group slots by time period cleanly
  const morningSlots = slotsStatus.filter((s) => s.slot < '13:00');
  const afternoonSlots = slotsStatus.filter((s) => s.slot >= '13:00' && s.slot < '17:00');
  const eveningSlots = slotsStatus.filter((s) => s.slot >= '17:00');

  const highlightedNearestSlot = nearestResult?.nearest;

  return (
    <AtelierShell id="book-datetime-container">
      {/* Top Header */}
      <header
        id="datetime-header"
        className="relative z-30 flex shrink-0 items-center justify-between px-6 pt-1"
        dir="rtl"
      >
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onBackToPreference();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white/70 shadow-sm transition-transform active:scale-95"
          title="بازگشت به انتخاب زمان دلخواه"
        >
          <ArrowRight className="h-4 w-4 text-stone-700" />
        </button>

        <div className="text-center">
          <span className="block text-[9px] font-semibold text-[#7e5352]">مرحله چهارم</span>
          <h1 className="font-serif text-sm font-semibold text-stone-900">
            تأیید ساعت نوبت در تقویم سالن
          </h1>
        </div>

        {onOpenProfile ? (
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onOpenProfile();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white/70 shadow-sm transition-transform active:scale-95"
            title="پروفایل کاربری"
          >
            <User className="h-4 w-4 text-stone-700" />
          </button>
        ) : (
          <div className="h-8 w-8" />
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-36 pt-3" dir="rtl">
        {/* Selected Service & Combined Duration Summary with Gap Breakdown */}
        <div className="mb-4 rounded-[22px] border border-white/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-stone-900">{service.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
                <span className="flex items-center gap-1 font-bold text-stone-800">
                  <Hourglass className="h-3.5 w-3.5 text-[#7e5352]" />
                  مجموع زمان مورد نیاز: {toPersianDigits(totals.totalDuration)} دقیقه
                </span>
                {totals.selectedExtras.length > 0 && (
                  <span className="text-[10px] text-stone-500">
                    ({toPersianDigits(service.durationMinutes)} دقیقه خدمت اصلی +{' '}
                    {toPersianDigits(totals.totalDuration - service.durationMinutes)} دقیقه تکمیلی)
                  </span>
                )}
              </div>
            </div>
            <div className="text-left">
              <span className="block text-[10px] text-stone-400">
                {activeBarber?.name || 'استاد پیرایش'}
              </span>
              <span className="text-[11px] font-bold text-stone-700">
                {activeChair?.name || 'سوئیت اختصاصی'}
              </span>
            </div>
          </div>
        </div>

        {/* Notice for Expired Slot Click Attempt */}
        {expiredNoticeMessage && (
          <div className="mb-4 rounded-[22px] border border-amber-200 bg-amber-50/90 p-3.5 shadow-sm backdrop-blur-xl animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-amber-200/80 p-2 text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
              </div>
              <p className="text-xs font-bold text-amber-950">
                {expiredNoticeMessage}
              </p>
            </div>
          </div>
        )}

        {/* Notice if All Slots on Selected Day Are Expired */}
        {isDayAllExpired && (
          <div className="mb-4 rounded-[24px] border border-stone-300 bg-stone-100/90 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-stone-200 p-2 text-stone-700">
                <Clock className="h-5 w-5 shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black text-stone-900">
                  ساعت کاری امروز به پایان رسیده است
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-stone-600">
                  کلیه ساعات کاری نوبت‌دهی امروز سپری شده‌اند. می‌توانید نوبت خود را برای فردا یا روزهای آینده ثبت فرمایید.
                </p>
                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticSelection();
                      onSelectDay(days[1].dayNumber);
                    }}
                    className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#7e5352] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <span>مشاهده تقویم فردا ({days[1].weekday}، {days[1].label})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Taken Slot Notice & Gap-Calculated Closest Slot Banner ── */}
        {targetBookedTime && !isDayAllExpired && (
          <div className="mb-4 rounded-[24px] border border-amber-300/90 bg-gradient-to-br from-amber-50/95 via-orange-50/80 to-amber-100/60 p-4 shadow-sm backdrop-blur-xl animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-200/80 p-2 text-amber-900">
                <AlertCircle className="h-5 w-5 shrink-0" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-amber-950">
                    {isTargetExpired
                      ? `ساعت ${toPersianDigits(targetBookedTime)} سپری شده است`
                      : `ساعت ${toPersianDigits(targetBookedTime)} قبلاً رزرو شده است`}
                  </h3>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      isTargetExpired
                        ? 'bg-stone-200 text-stone-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isTargetExpired ? 'منقضی شده' : 'تکمیل ظرفیت'}
                  </span>
                </div>

                <p className="mt-1 text-[11px] leading-5 text-amber-900">
                  {isTargetExpired
                    ? 'امکان رزرو برای ساعت‌های گذشته وجود ندارد. '
                    : 'این نوبت قبلاً توسط مشتری دیگری رزرو شده است. '}
                  {highlightedNearestSlot ? (
                    <>
                      با محاسبه فواصل خالی میان نوبت‌های موجود و مدت زمان خدمت شما (
                      {toPersianDigits(totals.totalDuration)} دقیقه)،{' '}
                      <strong className="font-black text-stone-900">
                        نزدیک‌ترین نوبت آزاد آینده (ساعت {toPersianDigits(highlightedNearestSlot)})
                      </strong>{' '}
                      به صورت خودکار برای شما انتخاب شد.
                    </>
                  ) : (
                    'برای این روز نوبت خالی دیگری در دسترس نیست؛ لطفاً روز دیگری را انتخاب فرمایید.'
                  )}
                </p>

                {nearestResult?.gapInfo && (
                  <div className="mt-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-[10px] text-stone-700 border border-amber-200/50 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[#7e5352]" />
                    <span>
                      بازه خالی شناسایی‌شده در تقویم: ساعت {toPersianDigits(nearestResult.gapInfo.start)} الی{' '}
                      {toPersianDigits(nearestResult.gapInfo.end)} ({toPersianDigits(nearestResult.gapInfo.gapDuration)} دقیقه)
                    </span>
                  </div>
                )}

                {highlightedNearestSlot && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-amber-200/70 pt-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950">
                      <Zap className="h-3.5 w-3.5 text-[#7e5352]" />
                      <span>نزدیک‌ترین نوبت در بازه خالی:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        hapticSelection();
                        onSelectTime(highlightedNearestSlot);
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition-all active:scale-95 ${
                        selectedTime === highlightedNearestSlot
                          ? 'bg-[#7e5352] text-white ring-2 ring-[#7e5352]/30'
                          : 'bg-white text-stone-900 border border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>ساعت {toPersianDigits(highlightedNearestSlot)}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Success Banner when Chosen Time is Available ── */}
        {!targetBookedTime && selectedTime && currentSlotStatus?.isAvailable && (
          <div className="mb-4 rounded-[24px] border border-emerald-200/80 bg-emerald-50/80 p-3.5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-950">
                  ساعت انتخابی ({toPersianDigits(selectedTime)}) با بازه زمانی {toPersianDigits(totals.totalDuration)} دقیقه کاملاً هماهنگ است و برای شما ثبت می‌شود.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Date Selector */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-xs font-black text-stone-800">
              <Calendar className="h-4 w-4 text-[#7e5352]" />
              تقویم روزهای سالن
            </h2>
            <span className="text-[11px] font-bold text-stone-500">
              {activeDay.weekday}، {activeDay.label}
            </span>
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const isSelected = d.dayNumber === selectedDay;
              return (
                <button
                  key={d.dayNumber}
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setTakenSlotAttempted(null);
                    onSelectDay(d.dayNumber);
                  }}
                  className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-2xl border p-2.5 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-[#7e5352] bg-[#7e5352] text-white shadow-md'
                      : 'border-white/70 bg-white/70 text-stone-700 hover:bg-white shadow-sm'
                  }`}
                >
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected ? 'text-amber-200' : 'text-stone-400'
                    }`}
                  >
                    {d.badge || d.weekday}
                  </span>
                  <span className="mt-0.5 text-base font-black">
                    {toPersianDigits(d.dayNumber)}
                  </span>
                  <span
                    className={`text-[9px] ${
                      isSelected ? 'text-white/80' : 'text-stone-500'
                    }`}
                  >
                    {d.label.split(' ')[1] || ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Time Selection Header */}
        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-xs font-black text-stone-800">
              <Clock className="h-4 w-4 text-[#7e5352]" />
              انتخاب ساعت نوبت (از ۹:۰۰ صبح)
            </h2>
            {selectedTime && currentSlotStatus?.isAvailable && (
              <span className="text-[11px] font-bold text-[#7e5352]">
                {toPersianDigits(selectedTime)} الی {toPersianDigits(endTime)}
              </span>
            )}
          </div>

          {/* Time Slot Groups */}
          <div className="space-y-3">
            {/* Morning Slots */}
            <div>
              <span className="mb-1.5 block text-[10px] font-bold text-stone-500 px-1">
                نوبت‌های صبح (۰۹:۰۰ - ۱۲:۴۰)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {morningSlots.map(({ slot, isAvailable, isExpired }) => {
                  const isSelected = selectedTime === slot;
                  const isNearest = highlightedNearestSlot === slot && isAvailable && !isExpired;
                  const isAttemptedTaken = takenSlotAttempted === slot && !isAvailable;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSlotClick(slot, isAvailable, isExpired)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border py-2.5 text-center text-xs font-bold transition-all ${
                        isExpired
                          ? 'border-stone-200/50 bg-stone-100/60 text-stone-300 cursor-not-allowed select-none opacity-60'
                          : isSelected && isAvailable
                          ? 'border-[#7e5352] bg-[#7e5352] text-white shadow-md ring-2 ring-[#7e5352]/20'
                          : isNearest
                          ? 'border-[#7e5352] bg-amber-50 text-[#7e5352] ring-2 ring-[#7e5352]/40 shadow-sm animate-pulse'
                          : isAttemptedTaken
                          ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
                          : !isAvailable
                          ? 'border-stone-200/60 bg-stone-100/70 text-stone-400 hover:border-amber-300 hover:bg-stone-100'
                          : 'border-white/80 bg-white/80 text-stone-800 shadow-sm hover:bg-white active:scale-95'
                      }`}
                    >
                      <span className={`text-xs font-mono ${isExpired ? 'line-through text-stone-400' : !isAvailable ? 'line-through opacity-70' : ''}`}>
                        {toPersianDigits(slot)}
                      </span>
                      {isExpired ? (
                        <span className="mt-0.5 text-[8px] font-semibold text-stone-400">منقضی شده</span>
                      ) : !isAvailable ? (
                        <span className="mt-0.5 text-[8px] font-medium text-rose-500">رزرو شده</span>
                      ) : isNearest && !isSelected ? (
                        <span className="mt-0.5 text-[8px] font-extrabold text-[#7e5352]">نزدیک‌ترین</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Afternoon Slots */}
            <div>
              <span className="mb-1.5 block text-[10px] font-bold text-stone-500 px-1">
                نوبت‌های بعدازظهر (۱۳:۰۰ - ۱۶:۴۰)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {afternoonSlots.map(({ slot, isAvailable, isExpired }) => {
                  const isSelected = selectedTime === slot;
                  const isNearest = highlightedNearestSlot === slot && isAvailable && !isExpired;
                  const isAttemptedTaken = takenSlotAttempted === slot && !isAvailable;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSlotClick(slot, isAvailable, isExpired)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border py-2.5 text-center text-xs font-bold transition-all ${
                        isExpired
                          ? 'border-stone-200/50 bg-stone-100/60 text-stone-300 cursor-not-allowed select-none opacity-60'
                          : isSelected && isAvailable
                          ? 'border-[#7e5352] bg-[#7e5352] text-white shadow-md ring-2 ring-[#7e5352]/20'
                          : isNearest
                          ? 'border-[#7e5352] bg-amber-50 text-[#7e5352] ring-2 ring-[#7e5352]/40 shadow-sm animate-pulse'
                          : isAttemptedTaken
                          ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
                          : !isAvailable
                          ? 'border-stone-200/60 bg-stone-100/70 text-stone-400 hover:border-amber-300 hover:bg-stone-100'
                          : 'border-white/80 bg-white/80 text-stone-800 shadow-sm hover:bg-white active:scale-95'
                      }`}
                    >
                      <span className={`text-xs font-mono ${isExpired ? 'line-through text-stone-400' : !isAvailable ? 'line-through opacity-70' : ''}`}>
                        {toPersianDigits(slot)}
                      </span>
                      {isExpired ? (
                        <span className="mt-0.5 text-[8px] font-semibold text-stone-400">منقضی شده</span>
                      ) : !isAvailable ? (
                        <span className="mt-0.5 text-[8px] font-medium text-rose-500">رزرو شده</span>
                      ) : isNearest && !isSelected ? (
                        <span className="mt-0.5 text-[8px] font-extrabold text-[#7e5352]">نزدیک‌ترین</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Evening Slots */}
            <div>
              <span className="mb-1.5 block text-[10px] font-bold text-stone-500 px-1">
                نوبت‌های عصر و شب (۱۷:۰۰ - ۲۱:۳۰)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {eveningSlots.map(({ slot, isAvailable, isExpired }) => {
                  const isSelected = selectedTime === slot;
                  const isNearest = highlightedNearestSlot === slot && isAvailable && !isExpired;
                  const isAttemptedTaken = (targetBookedTime === slot || takenSlotAttempted === slot) && !isAvailable;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSlotClick(slot, isAvailable, isExpired)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border py-2.5 text-center text-xs font-bold transition-all ${
                        isExpired
                          ? 'border-stone-200/50 bg-stone-100/60 text-stone-300 cursor-not-allowed select-none opacity-60'
                          : isSelected && isAvailable
                          ? 'border-[#7e5352] bg-[#7e5352] text-white shadow-md ring-2 ring-[#7e5352]/20'
                          : isNearest
                          ? 'border-[#7e5352] bg-amber-50 text-[#7e5352] ring-2 ring-[#7e5352]/40 shadow-sm animate-pulse'
                          : isAttemptedTaken
                          ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
                          : !isAvailable
                          ? 'border-stone-200/60 bg-stone-100/70 text-stone-400 hover:border-amber-300 hover:bg-stone-100'
                          : 'border-white/80 bg-white/80 text-stone-800 shadow-sm hover:bg-white active:scale-95'
                      }`}
                    >
                      <span className={`text-xs font-mono ${isExpired ? 'line-through text-stone-400' : !isAvailable ? 'line-through opacity-70' : ''}`}>
                        {toPersianDigits(slot)}
                      </span>
                      {isExpired ? (
                        <span className="mt-0.5 text-[8px] font-semibold text-stone-400">منقضی شده</span>
                      ) : !isAvailable ? (
                        <span className="mt-0.5 text-[8px] font-medium text-rose-500">رزرو شده</span>
                      ) : isNearest && !isSelected ? (
                        <span className="mt-0.5 text-[8px] font-extrabold text-[#7e5352]">نزدیک‌ترین</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Live Price Summary */}
      <PriceSummary
        service={service}
        accoutrements={accoutrements}
        ctaLabel="تأیید زمان و رفتن به پرداخت"
        onCta={onContinueToCheckout}
        ctaDisabled={!selectedTime || !currentSlotStatus?.isAvailable || isSlotExpired(selectedDay, selectedTime)}
        disabledHint={
          !selectedTime
            ? 'لطفاً ساعت نوبت را انتخاب کنید'
            : isSlotExpired(selectedDay, selectedTime)
            ? 'ساعت انتخابی سپری شده است؛ لطفاً ساعت آینده را انتخاب نمایید'
            : !currentSlotStatus?.isAvailable
            ? 'ساعت انتخابی تکمیل است؛ لطفاً یکی از ساعت‌های خالی را انتخاب کنید'
            : undefined
        }
      />
    </AtelierShell>
  );
};
