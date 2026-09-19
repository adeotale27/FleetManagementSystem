import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Download, MessageCircle, Printer, Truck } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { Badge, Btn, Card, ErrorState, Loader, PageHead, toast } from "../components/ui";

export default function LRView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: lr, loading, error, reload } = useFetch(`/lrs/${id}`);

  if (loading && !lr) return <Loader />;
  if (error) return <ErrorState text={error} onRetry={reload} />;

  const c = lr.company || {};
  const cancel = async () => {
    if (!window.confirm("Cancel this LR? The freight will be reversed from the party ledger.")) return;
    try { await api.post(`/lrs/${id}/cancel`); toast("LR cancelled"); reload(); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  const download = () => {
    const html = document.getElementById("lr-doc").outerHTML;
    const blob = new Blob([`<html><head><meta charset="utf-8"><title>${lr.lr_no}</title>
      <script src="https://cdn.tailwindcss.com"></script></head><body class="p-6">${html}</body></html>`],
      { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${lr.lr_no}.html`;
    a.click();
  };

  const share = () => {
    const mob = String(lr.sender?.mobile || lr.receiver?.mobile || "").replace(/\D/g, "");
    const text = [
      `*${c.name || "Transport"}* — Lorry Receipt`,
      `LR No: ${lr.lr_no}`,
      `Date: ${dmy(lr.date)}`,
      `Route: ${lr.from_name} → ${lr.to_name}`,
      `Vehicle: ${lr.vehicle_no}${lr.driver_name ? ` · Driver: ${lr.driver_name}` : ""}`,
      `Sender: ${lr.sender?.name || "—"}`,
      `Receiver: ${lr.receiver?.name || "—"}`,
      `Goods: ${(lr.items?.length ? lr.items.map((i) => i.description).filter(Boolean).join(", ") : lr.goods_description) || "—"}`,
      `Freight: ${money(lr.freight)} (${lr.payment_status})`,
      lr.outstanding > 0 ? `Pending: ${money(lr.outstanding)}` : "",
      c.mobile ? `Contact: ${c.mobile}` : "",
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/${mob ? (mob.length === 10 ? `91${mob}` : mob) : ""}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const rows = lr.items?.length ? lr.items : [{
    description: lr.goods_description, quantity: lr.quantity, weight: lr.weight,
    rate: "", amount: lr.freight,
  }];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageHead title={`LR ${lr.lr_no}`} back="/trips?tab=lrs"
          subtitle={`${dmy(lr.date)} · ${lr.from_name} → ${lr.to_name}`}
          actions={
            <div className="flex max-w-full flex-wrap gap-2">
              <Btn variant="s" icon={Printer} data-testid="print-lr" onClick={() => window.print()}>Print</Btn>
              <Btn variant="s" icon={MessageCircle} data-testid="share-lr-whatsapp" onClick={share}>WhatsApp</Btn>
              <Btn variant="s" icon={Download} data-testid="download-lr" onClick={download}>Download</Btn>
              {lr.trip_id && <Btn variant="s" icon={Truck} onClick={() => nav(`/trips/${lr.trip_id}`)}>Open Trip</Btn>}
              {!lr.cancelled && <Btn variant="d" icon={Ban} onClick={cancel}>Cancel LR</Btn>}
            </div>
          } />
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Freight", money(lr.freight)], ["Received", money(lr.received)],
            ["Outstanding", money(lr.outstanding)], ["Status", lr.payment_status]].map(([k, v]) => (
            <Card key={k} className="p-3.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{k}</p>
              {k === "Status" ? <div className="mt-2"><Badge>{v}</Badge></div>
                : <p className="num mt-1.5 font-head text-[19px] font-bold">{v}</p>}
            </Card>
          ))}
        </div>
      </div>

      <div id="lr-doc" className="print-area card mx-auto overflow-hidden border border-ink/25 bg-white"
        style={{ width: "100%", maxWidth: "210mm" }} data-testid="lr-document">
        <div className="flex items-start justify-between gap-4 border-b-2 border-brand-500 px-6 py-5">
          <div className="flex items-start gap-3">
            {c.logo
              ? <img src={c.logo} alt="" className="h-14 w-14 rounded-lg bg-white object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : <div className="grid h-14 w-14 place-items-center rounded-lg bg-ink text-[16px] font-bold text-white">
                  {(c.name || "LR").slice(0, 2).toUpperCase()}
                </div>}
            <div>
              <h2 className="font-head text-[22px] font-extrabold uppercase leading-tight text-ink">{c.name}</h2>
              <p className="text-[12.5px] text-muted">{c.address}{c.city ? `, ${c.city}` : ""}{c.state ? `, ${c.state}` : ""}</p>
              <p className="text-[12.5px] text-muted">
                {c.mobile && `Mob: ${c.mobile}`}{c.alt_mobile && `, ${c.alt_mobile}`}
                {c.gstin && ` · GSTIN: ${c.gstin}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="rounded bg-ink px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wider text-white">Lorry Receipt</p>
            <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-600">Original — Consignor Copy</p>
            <p className="num mt-1 font-head text-[19px] font-bold">{lr.lr_no}</p>
            <p className="text-[12.5px] text-muted">Date: {dmy(lr.date)}</p>
            {lr.cancelled && <p className="mt-1 text-[12px] font-bold text-red-600">CANCELLED</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <Block title="Sender" lines={[lr.sender?.name, lr.sender?.mobile, lr.sender?.city]} />
          <Block title="Receiver" lines={[lr.receiver?.name, lr.receiver?.mobile, lr.receiver?.address,
            [lr.receiver?.city, lr.receiver?.state, lr.receiver?.pincode].filter(Boolean).join(", ")]} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-line px-6 py-4 text-[13px] md:grid-cols-4">
          {[["From", lr.from_name], ["To", lr.to_name], ["Vehicle No", lr.vehicle_no],
            ["Driver", lr.driver_name || "—"], ["Trip No", lr.trip_no || "—"],
            ["Freight Type", lr.freight_type], ["Payment", lr.payment_status],
            ...(lr.optional?.invoice_no ? [["Invoice No", lr.optional.invoice_no]] : []),
            ...(lr.optional?.eway ? [["E-way Bill", lr.optional.eway]] : []),
            ...(lr.optional?.hsn ? [["HSN", lr.optional.hsn]] : []),
            ...(lr.optional?.packaging ? [["Packaging", lr.optional.packaging]] : []),
            ...(lr.optional?.goods_value ? [["Goods Value", money(lr.optional.goods_value)]] : []),
          ].map(([k, v]) => (
            <div key={k}><p className="text-[11px] font-bold uppercase tracking-wide text-muted">{k}</p>
              <p className="font-semibold">{v || "—"}</p></div>
          ))}
        </div>

        <table className="w-full text-[13px]">
          <thead className="bg-canvas">
            <tr>
              <th className="th">Description of Goods</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Weight (kg)</th>
              <th className="th text-right">Rate</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((it, i) => (
              <tr key={i}>
                <td className="td">{it.description || "—"}</td>
                <td className="td num text-right">{it.quantity || "—"}</td>
                <td className="td num text-right">{it.weight || "—"}</td>
                <td className="td num text-right">{it.rate ? money(it.rate) : "—"}</td>
                <td className="td num text-right">{money(it.amount)}</td>
              </tr>
            ))}
            <tr className="bg-canvas font-bold">
              <td className="td" colSpan={4}>Total Freight</td>
              <td className="td num text-right">{money(lr.freight)}</td>
            </tr>
          </tbody>
        </table>

        {lr.remarks && <p className="border-t border-line px-6 py-3 text-[13px]"><b>Remarks:</b> {lr.remarks}</p>}

        <div className="grid grid-cols-2 gap-6 border-t-2 border-brand-500 px-6 py-5 text-[12px] text-muted">
          <div>
            <p className="font-bold uppercase tracking-wide text-ink">Terms &amp; Conditions</p>
            <p className="mt-1 leading-relaxed">{c.terms}</p>
            <p className="mt-3">{c.footer}</p>
            <div className="mt-6">
              <p className="border-t border-ink/40 pt-1.5 font-semibold text-ink">Receiver's Signature</p>
            </div>
          </div>
          <div className="flex flex-col items-end justify-between">
            <p className="text-right text-[11.5px]">Freight Total: <span className="num font-bold text-ink">{money(lr.freight)}</span><br />
              Payment: <span className="font-bold text-ink">{lr.payment_status}</span></p>
            <div className="mt-10 w-48 text-right">
              <p className="border-t border-ink/40 pt-1.5 font-semibold text-ink">For {c.name}</p>
              <p className="text-[11px]">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>

      {lr.receipts?.length > 0 && (
        <Card className="no-print mt-4 overflow-hidden">
          <div className="border-b border-line px-4 py-3"><h3 className="font-head text-[15.5px] font-bold">Payments against this LR</h3></div>
          <table className="w-full">
            <tbody className="divide-y divide-line">
              {lr.receipts.map((r) => (
                <tr key={r.id}>
                  <td className="td">{dmy(r.date)}</td>
                  <td className="td">{r.mode}{r.deewanji_name ? ` · ${r.deewanji_name}` : ""}</td>
                  <td className="td num text-right font-semibold">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const Block = ({ title, lines }) => (
  <div className="px-6 py-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
    <p className="mt-1 font-head text-[16px] font-bold text-ink">{lines[0] || "—"}</p>
    {lines.slice(1).filter(Boolean).map((l, i) => <p key={i} className="text-[13px] text-muted">{l}</p>)}
  </div>
);
