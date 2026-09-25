import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Gift,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Accoutrement, AccoutrementInput } from '../../types';
import { useAtelier } from '../../store/AtelierContext';
import { useDragList } from '../../hooks/useDragList';
import { formatDuration, formatPrice } from '../../utils/formatUtils';
import { toPersianDigits } from '../../utils/dateUtils';
import { AccoutrementFormModal } from './AccoutrementFormModal';

interface AccoutrementsManagementSectionProps {
  onToast: (msg: string) => void;
}

export const AccoutrementsManagementSection: React.FC<AccoutrementsManagementSectionProps> = ({
  onToast,
}) => {
  const {
    accoutrements,
    addAccoutrement,
    updateAccoutrement,
    deleteAccoutrement,
    moveAccoutrement,
    reorderAccoutrements,
  } = useAtelier();

  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{
    open: boolean;
    editing: Accoutrement | null;
  }>({ open: false, editing: null });
  const [pendingDelete, setPendingDelete] = useState<Accoutrement | null>(null);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return accoutrements;
    const query = search.toLowerCase();
    return accoutrements.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query))
    );
  }, [accoutrements, search]);

  const drag = useDragList(
    filteredItems.map((a) => a.id),
    reorderAccoutrements
  );

  const rows = useMemo(() => {
    const map = new Map(filteredItems.map((a) => [a.id, a] as const));
    return drag.displayOrder.map((id) => map.get(id)).filter((a): a is Accoutrement => Boolean(a));
  }, [filteredItems, drag.displayOrder]);

  return (
    <div className="space-y-4">
      {/* Header / Sub-banner */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#7e5352]" />
            فهرست خدمات مکمل و مراقبتی (Accoutrements)
          </h2>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {toPersianDigits(accoutrements.length)} خدمت مکمل تعریف‌شده برای انتخاب اختیاری توسط مراجعین
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ open: true, editing: null })}
          className="flex items-center gap-1.5 rounded-xl bg-[#7e5352] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#6c4342] cursor-pointer transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>مکمل جدید</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام یا مشخصات خدمت مکمل..."
          className="w-full rounded-2xl border border-white/80 bg-white/70 py-2.5 pl-3 pr-9 text-xs font-medium text-stone-800 placeholder-stone-400 shadow-sm backdrop-blur-md outline-none focus:border-[#7e5352] focus:ring-2 focus:ring-[#7e5352]/20"
        />
      </div>

      {/* List Container */}
      <section
        style={{
          width: '335px',
          marginRight: '-15px',
          paddingLeft: '6px',
          height: '410px',
        }}
        className="overflow-y-auto rounded-[24px] border border-white/70 bg-white/50 p-3 shadow-sm backdrop-blur-xl"
      >
        <div className="space-y-2">
          {rows.length === 0 && (
            <div
              style={{ height: '83.5px' }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 px-4 py-2 text-center"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                <Sparkles className="h-4 w-4 text-stone-400" />
                <span>خدمت مکملی یافت نشد</span>
              </div>
              <p className="mt-0.5 text-[10px] text-stone-400">
                با زدن دکمه «مکمل جدید» یک خدمت مراقبتی یا ماساژ اضافه کنید.
              </p>
            </div>
          )}

          {rows.map((acc, index) => (
            <div
              key={acc.id}
              style={{ minHeight: '80px' }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', acc.id);
                drag.handleDragStart(acc.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                drag.handleDragOver(acc.id);
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={drag.handleDragEnd}
              className={`flex items-center gap-2 rounded-2xl border bg-white/85 px-3 py-2.5 transition-all hover:bg-white ${
                drag.draggingId === acc.id
                  ? 'border-[#7e5352] opacity-50 ring-2 ring-[#7e5352]/20'
                  : 'border-white/80 shadow-xs'
              }`}
            >
              {/* Drag Handle */}
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-stone-300" />

              {/* Arrow reorder buttons */}
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  title="انتقال به بالا"
                  disabled={index === 0}
                  onClick={() => moveAccoutrement(acc.id, 'up')}
                  className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="انتقال به پایین"
                  disabled={index === rows.length - 1}
                  onClick={() => moveAccoutrement(acc.id, 'down')}
                  className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Status/Badge */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-bold text-stone-900">{acc.name}</p>
                  {acc.isComplimentary ? (
                    <span className="flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 border border-emerald-200">
                      <Gift className="h-2.5 w-2.5" />
                      رایگان
                    </span>
                  ) : (
                    <span className="text-[11px] font-black text-[#7e5352]">
                      {formatPrice(acc.price)}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-500">
                  {acc.durationMinutes > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-stone-400" />
                      {formatDuration(acc.durationMinutes)}
                    </span>
                  )}
                  {acc.description && (
                    <span className="truncate max-w-[180px] text-stone-400">
                      {acc.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="ویرایش خدمت مکمل"
                  onClick={() => setModalState({ open: true, editing: acc })}
                  className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="حذف خدمت مکمل"
                  onClick={() => setPendingDelete(acc)}
                  className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form Modal */}
      <AccoutrementFormModal
        isOpen={modalState.open}
        editing={modalState.editing}
        onClose={() => setModalState({ open: false, editing: null })}
        onSubmit={(input: AccoutrementInput) => {
          const result = modalState.editing
            ? updateAccoutrement(modalState.editing.id, input)
            : addAccoutrement(input);
          if (result.success) {
            onToast(modalState.editing ? 'تغییرات خدمت مکمل ذخیره شد' : 'خدمت مکمل جدید اضافه شد');
            setModalState({ open: false, editing: null });
          }
          return result;
        }}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
              className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-50 p-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">حذف خدمت مکمل</h3>
                  <p className="mt-1.5 text-xs leading-5 text-stone-500">
                    آیا از حذف خدمت مکمل «{pendingDelete.name}» مطمئن هستید؟
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const res = deleteAccoutrement(pendingDelete.id);
                    if (res.success) {
                      onToast(`«${pendingDelete.name}» حذف شد`);
                      setPendingDelete(null);
                    } else {
                      onToast(res.message ?? 'خطا در حذف');
                    }
                  }}
                  className="rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                >
                  حذف خدمت مکمل
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded-xl border border-stone-200 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
