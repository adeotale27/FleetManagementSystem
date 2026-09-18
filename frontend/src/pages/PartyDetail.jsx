import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banknote, Download, FileText, Pencil } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { exportCSV, exportPDF } from "../lib/export";
import MasterForm from "../components/MasterForm";
import EntryModal from "../components/QuickForms";
import {
  Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, Stat, Tabs,
} from "../components/ui";

const LEDGER_COLS = [
  { key: "date", label: "Date", type: "date" },
  { key: "description", label: "Description", strong: true },
  { key: "debit", label: "Debit", type: "money", right: true },
  { key: "credit", label: "Credit", type: "money", right: true },
  { key: "balance", label: "Balance", type: "money", right: true },
];

export default function PartyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(`/profile/party/${id}`);
  const [tab, setTab] = useState("ledger");
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState(false);

  if (loading && !data) return <Loader />;
  if (error) return <ErrorState text={error} onRetry={reload} />;
  const p = data.party;
  const billed = data.ledger.filter((r) => !r.cancelled).reduce((s, r) => s + r.debit, 0);
  const received = data.ledger.filter((r) => !r.cancelled).reduce((s, r) => s + r.credit, 0);

  return (
    <div>
      <PageHead title={p.name} back="/parties"
        subtitle={[p.mobile, p.city, p.gstin].filter(Boolean).join(" · ") || "No contact details yet"}
        actions={
          <>
            <Btn variant="s" icon={FileText} data-testid="party-create-lr" onClick={() => nav("/lrs/new")}>Create LR</Btn>
            <Btn icon={Banknote} data-testid="party-record-payment" onClick={() => setEntry(true)}>Record Payment</Btn>
            <Btn variant="s" icon={Pencil} onClick={() => setEdit(true)}>Edit</Btn>
          </>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat testid="party-outstanding" label="Outstanding" value={money(data.outstanding)} tone={data.outstanding > 0 ? "text-brand-600" : ""} />
        <Stat label="Total Billed" value={money(billed)} />
        <Stat label="Total Received" value={money(received)} />
        <Stat label="Total LRs" value={data.lrs.length} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "ledger", label: "Ledger", count: data.ledger.length },
        { value: "lrs", label: "LRs", count: data.lrs.length },
        { value: "payments", label: "Payments", count: data.receipts.length },
      ]} />

      <Card className="overflow-hidden">
        {tab === "ledger" && (
          <DataTable testid="party-ledger" columns={LEDGER_COLS} rows={data.ledger}
            onRowClick={(r) => r.ref_type === "lr" && nav(`/lrs/${r.ref_id}`)}
            empty={<EmptyState title="No transactions yet" text="Create an LR or record a payment to start the ledger." />}
            mobile={(r) => (
              <div>
                <div className="flex justify-between gap-3">
                  <span className="text-[13.5px] font-semibold">{r.description}</span>
                  <span className={`num text-[13.5px] font-semibold ${r.debit ? "text-ink" : "text-brand-600"}`}>
                    {r.debit ? `+${money(r.debit)}` : `-${money(r.credit)}`}
                  </span>
                </div>
                <p className="mt-1 flex justify-between text-[12.5px] text-muted">
                  <span>{dmy(r.date)}{r.cancelled ? " · CANCELLED" : ""}</span>
                  <span className="num">Bal {money(r.balance)}</span>
                </p>
              </div>
            )} />
        )}
        {tab === "lrs" && (
          <DataTable testid="party-lrs"
            columns={[
              { key: "lr_no", label: "LR No", strong: true },
              { key: "date", label: "Date", type: "date" },
              { key: "from_name", label: "From" },
              { key: "to_name", label: "To" },
              { key: "freight", label: "Freight", type: "money", right: true },
              { key: "received", label: "Received", type: "money", right: true },
              { key: "outstanding", label: "Pending", type: "money", right: true },
              { key: "payment_status", label: "Status", type: "badge" },
            ]} rows={data.lrs} onRowClick={(r) => nav(`/lrs/${r.id}`)}
            empty={<EmptyState title="No LRs for this party" />} />
        )}
        {tab === "payments" && (
          <DataTable testid="party-payments"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "amount", label: "Amount", type: "money", right: true },
              { key: "mode", label: "Mode" },
              { key: "lr_no", label: "Against LR" },
              { key: "deewanji_name", label: "Collected By" },
              { key: "reference", label: "Reference" },
            ]} rows={data.receipts} empty={<EmptyState title="No payments recorded" />} />
        )}
      </Card>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Btn variant="s" icon={Download} onClick={() => exportCSV(`${p.name}-ledger`, LEDGER_COLS,
          data.ledger.map((r) => ({ ...r, date: dmy(r.date) })))}>Ledger CSV</Btn>
        <Btn variant="s" icon={FileText} onClick={() => exportPDF(`${p.name} — Party Ledger`, LEDGER_COLS,
          data.ledger.map((r) => ({ ...r, date: dmy(r.date) })), `Outstanding: ${money(data.outstanding)}`)}>Ledger PDF</Btn>
      </div>

      <MasterForm res="parties" item={p} open={edit} onClose={() => setEdit(false)} onDone={reload} />
      <EntryModal kind="collection" open={entry} onClose={() => setEntry(false)} onDone={reload}
        preset={{ party_id: id, party_name: p.name }} />
    </div>
  );
}
