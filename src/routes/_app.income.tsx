import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Settings as SetIcon,
  List,
  LayoutGrid,
  Eye,
  Share2,
} from "lucide-react";
import { PageHeader } from "@/components/ui-bits/PageHeader";
import { StatCard } from "@/components/ui-bits/StatCard";
import { EmptyState } from "@/components/ui-bits/EmptyState";
import { ConfirmDialog } from "@/components/ui-bits/ConfirmDialog";
import { Modal } from "@/components/ui-bits/Modal";
import { ldb } from "@/lib/local-db";
import { formatINR, formatDateIST, todayIST, shareBase64Image } from "@/lib/format";

export const Route = createFileRoute("/_app/income")({
  head: () => ({ meta: [{ title: "Income | 16 Eyes Farm House" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === true || search.new === "true",
  }),
  component: IncomePage,
});

interface IncomeRow {
  id: string;
  date: string;
  amount: number;
  payment_mode: string;
  reference: string | null;
  description: string | null;
  type_id: string;
  type: { id: string; name: string } | null;
}
interface TypeRow {
  id: string;
  name: string;
}
interface FormVals {
  date: string;
  type_id: string;
  amount: number;
  payment_mode: string;
  reference?: string;
  description?: string;
}

function IncomePage() {
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [delTarget, setDelTarget] = useState<IncomeRow | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<IncomeRow | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<FormVals>();

  const load = () => {
    const t = ldb.list<TypeRow>("income_types", "name", true);
    setTypes(t);
    const r = ldb.list<any>("incomes", "date", false).map((row) => ({
      ...row,
      type: t.find((x: TypeRow) => x.id === row.type_id) ?? null,
    }));
    setRows(r);
  };

  const { new: autoAdd } = Route.useSearch();
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (autoAdd && types.length > 0) open();
  }, [autoAdd, types]);

  const open = (i?: IncomeRow) => {
    setEditing(i ?? null);
    reset(
      i
        ? {
            date: i.date,
            type_id: i.type?.id ?? "",
            amount: i.amount,
            payment_mode: i.payment_mode,
            reference: i.reference ?? "",
            description: i.description ?? "",
          }
        : {
            date: todayIST(),
            type_id: types[0]?.id ?? "",
            amount: "" as any,
            payment_mode: "Cash",
            reference: "",
            description: "",
          },
    );
    setShowForm(true);
  };

  const onSubmit = async (v: FormVals) => {
    const payload: any = { ...v, amount: Number(v.amount) };
    if (editing) {
      ldb.update("incomes", editing.id, payload);
      toast.success("Income updated");
    } else {
      ldb.insert("incomes", payload);
      toast.success("Income added");
    }
    setShowForm(false);
    load();
  };

  const doDel = () => {
    if (!delTarget) return;
    ldb.softDelete("incomes", delTarget.id);
    toast.success("Deleted");
    setDelTarget(null);
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const [view, setView] = useState<"table" | "cards">("table");
  const filtered = rows;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={DollarSign}
        title="Income"
        subtitle="Track other sources of income"
        action={
          <div className="flex gap-2">
            <div className="flex rounded-md border border-input bg-card">
              <button
                onClick={() => setView("table")}
                className={`px-3 py-2 ${view === "table" ? "bg-gold text-white" : ""}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setView("cards")}
                className={`px-3 py-2 ${view === "cards" ? "bg-gold text-white" : ""}`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
            <button
              onClick={() => setShowTypes(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <SetIcon size={14} /> Manage Types
            </button>
            <button
              onClick={() => open()}
              disabled={types.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm text-white hover:bg-navy-hover disabled:opacity-50"
            >
              <Plus size={16} /> Add Income
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={DollarSign} label="Total Income" value={formatINR(total)} tone="success" />
        <StatCard icon={DollarSign} label="Records" value={rows.length} tone="navy" />
        <StatCard icon={DollarSign} label="Types" value={types.length} tone="gold" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No income recorded"
          subtitle={
            types.length === 0
              ? "Create at least one income type first."
              : "Add your first income entry."
          }
          action={
            types.length === 0 ? (
              <button
                onClick={() => setShowTypes(true)}
                className="rounded-md bg-navy px-4 py-2 text-sm text-white"
              >
                Manage Types
              </button>
            ) : (
              <button
                onClick={() => open()}
                className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm text-white"
              >
                <Plus size={14} /> Add Income
              </button>
            )
          }
        />
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 text-sm">{formatDateIST(i.date)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      {i.type?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-success">
                    {formatINR(i.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm">{i.payment_mode}</td>
                  <td className="px-4 py-3 text-sm">
                    {i.reference?.startsWith("data:image") ? "Image Attached" : (i.reference ?? "-")}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {i.description ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewing(i)} className="rounded p-1.5 hover:bg-muted text-info" title="View Details">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => open(i)} className="rounded p-1.5 hover:bg-muted">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDelTarget(i)}
                        className="rounded p-1.5 text-danger hover:bg-muted"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-background">
                <td colSpan={2} className="px-4 py-3 text-right text-sm font-semibold">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-success">
                  {formatINR(total)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((i) => (
            <div
              key={i.id}
              className="rounded-xl border border-border bg-card p-4 transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {formatDateIST(i.date)}
                </span>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  {i.type?.name}
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-success">{formatINR(i.amount)}</div>
              <div className="mt-1 text-sm font-medium">{i.payment_mode}</div>
              {i.reference && (
                <div className="text-xs text-muted-foreground">
                  Ref: {i.reference.startsWith("data:image") ? "Image Attached" : i.reference}
                </div>
              )}
              {i.description && (
                <p className="mt-2 text-xs line-clamp-2 text-muted-foreground italic">
                  "{i.description}"
                </p>
              )}
              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => setViewing(i)}
                  className="flex-1 rounded-md border border-info/20 py-1.5 text-xs font-medium text-info hover:bg-info hover:text-white transition"
                >
                  View
                </button>
                <button
                  onClick={() => open(i)}
                  className="flex-1 rounded-md border border-border py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDelTarget(i)}
                  className="flex-1 rounded-md border border-danger/20 py-1.5 text-xs font-medium text-danger hover:bg-danger hover:text-white transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Income" : "Add Income"}
        footer={
          <>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              form="income-form"
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-navy px-4 py-2 text-sm text-white"
            >
              Save
            </button>
          </>
        }
      >
        <form
          id="income-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Date *">
            <input type="date" {...register("date", { required: true })} className={inp} />
          </Field>
          <Field label="Type *">
            <select {...register("type_id", { required: true })} className={inp}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount ₹ *">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              {...register("amount", { required: true, valueAsNumber: true })}
              className={inp}
            />
          </Field>
          <Field label="Payment Mode">
            <select {...register("payment_mode")} className={inp}>
              <option>UPI</option>
              <option>Cash</option>
              <option>Cheque</option>
              <option>BankTransfer</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Receipt / Image (Optional)">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setValue("reference", reader.result as string);
                reader.readAsDataURL(f);
              }}
              className={inp}
            />
            {watch("reference")?.startsWith("data:image") && (
              <div className="mt-2 relative inline-block">
                <img src={watch("reference")} alt="Receipt" className="h-20 w-20 object-cover rounded-md border border-border" />
                <button type="button" onClick={() => setValue("reference", "")} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 h-5 w-5 flex items-center justify-center text-xs">×</button>
              </div>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea rows={3} maxLength={500} {...register("description")} className={inp} />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Income Details">
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{formatDateIST(viewing.date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium">{viewing.type?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-bold text-success">{formatINR(viewing.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Mode</p>
                <p className="font-medium">{viewing.payment_mode}</p>
              </div>
            </div>
            
            {viewing.description && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1">{viewing.description}</p>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-2">Receipt / Reference</p>
              {viewing.reference?.startsWith("data:image") ? (
                <div className="space-y-3">
                  <img src={viewing.reference} alt="Receipt" className="max-h-48 rounded-md border border-border object-cover cursor-pointer hover:opacity-90 shadow-sm" onClick={() => setViewImage(viewing.reference!)} />
                  <div className="flex gap-2">
                    <button onClick={() => setViewImage(viewing.reference!)} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted text-navy transition">
                      <Eye size={14} /> View
                    </button>
                    <button onClick={() => shareBase64Image(viewing.reference!, `Income_${viewing.date}`)} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted text-success transition">
                      <Share2 size={14} /> Share
                    </button>
                  </div>
                </div>
              ) : (
                <p className="font-medium">{viewing.reference || "None"}</p>
              )}
            </div>
            
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewing(null)} className="rounded-md border border-border px-4 py-2 hover:bg-muted">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewImage} onClose={() => setViewImage(null)} title="Receipt / Image">
        <div className="flex justify-center p-2">
          {viewImage && <img src={viewImage} alt="Receipt" className="max-h-[70vh] max-w-full rounded-md object-contain" />}
        </div>
      </Modal>

      <TypeManager
        open={showTypes}
        onClose={() => setShowTypes(false)}
        table="income_types"
        usageTable="incomes"
        types={types}
        reload={load}
      />
      <ConfirmDialog
        open={!!delTarget}
        title="Delete income?"
        body="This action cannot be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setDelTarget(null)}
        onConfirm={doDel}
      />
    </div>
  );
}

const inp =
  "w-full rounded-md border border-input bg-muted px-3 py-2 text-base outline-none focus:border-navy";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

export function TypeManager({
  open,
  onClose,
  table,
  usageTable,
  types,
  reload,
}: {
  open: boolean;
  onClose: () => void;
  table: "income_types" | "expense_types";
  usageTable: "incomes" | "expenses";
  types: TypeRow[];
  reload: () => void;
}) {
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    ldb.insert<any>(table, { name: name.trim() });
    setName("");
    reload();
    toast.success("Type added");
  };

  const save = (id: string) => {
    if (!editName.trim()) return;
    ldb.update<any>(table, id, { name: editName.trim() });
    setEditId(null);
    reload();
  };

  const del = (t: TypeRow) => {
    // Check if in use
    const inUse = ldb.where<any>(usageTable, "type_id", t.id).length > 0;
    if (inUse) {
      const ok = window.confirm(
        `This category is used in your records. Move those records to "Other"?`,
      );
      if (!ok) return;
      // Ensure "Other" exists
      let other = ldb.list<TypeRow>(table, "name", true).find((x) => x.name === "Other");
      if (!other) other = ldb.insert<any>(table, { name: "Other" }) as TypeRow;
      // Reassign records
      ldb.all<any>(usageTable)
        .filter((r) => r.type_id === t.id)
        .forEach((r) => ldb.update<any>(usageTable, r.id, { type_id: other!.id }));
    }
    ldb.delete(table, t.id);
    toast.success("Category removed");
    reload();
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Types">
      <ul className="space-y-2">
        {types.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-md border border-border p-2">
            {editId === t.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inp + " flex-1"}
                />
                <button
                  onClick={() => save(t.id)}
                  className="rounded-md bg-navy px-3 py-1.5 text-xs text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{t.name}</span>
                <button
                  onClick={() => {
                    setEditId(t.id);
                    setEditName(t.name);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-navy"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => del(t)} className="p-1.5 text-danger">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New type name"
          className={inp + " flex-1"}
        />
        <button onClick={add} className="rounded-md bg-navy px-4 py-2 text-sm text-white">
          Add
        </button>
      </div>
    </Modal>
  );
}
