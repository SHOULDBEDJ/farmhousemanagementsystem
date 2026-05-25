import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui-bits/Modal";
import { formatINR, formatDateIST } from "@/lib/format";
import { 
  Printer, 
  MessageCircle, 
  Clock, 
  Send, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  Sparkles, 
  Calendar, 
  User, 
  Phone, 
  CreditCard,
  FileText,
  Activity,
  Layers,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { 
  getSavedTemplates, 
  getSuggestedTemplates, 
  generateAIDynamicContent, 
  getSentHistory, 
  addSentHistoryLog,
  SentHistoryLog,
  AI_TONES
} from "@/lib/whatsapp-engine";

export interface ViewBooking {
  id: string;
  order_id: string;
  customer_name: string;
  mobile: string;
  id_proof_type: string | null;
  id_proof_number: string | null;
  guests: number;
  booking_date: string;
  agreed_total: number;
  advance_paid: number;
  discount: number;
  status: string;
  notes: string | null;
  created_at: string;
  slot: { name: string; color: string; start_time: string; end_time: string } | null;
}

export function BookingViewModal({
  open,
  onClose,
  booking,
  farmhouse,
  onUpdateStatus, // Optional callback to update status directly from timeline/panel
}: {
  open: boolean;
  onClose: () => void;
  booking: ViewBooking | null;
  farmhouse: { name: string; address?: string; phone?: string; notes?: string };
  onUpdateStatus?: (status: string) => void;
}) {
  if (!booking) return null;

  // Local storage lists & configurations
  const templates = getSavedTemplates();
  
  // States
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [aiTone, setAiTone] = useState("Friendly");
  const [messageContent, setMessageContent] = useState("");
  const [historyLogs, setHistoryLogs] = useState<SentHistoryLog[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "sending" | "sent" | "delivered" | "read">("idle");
  const [scheduleTime, setScheduleTime] = useState("");
  
  // Custom Variables state (e.g. BBQ packages, check-in instructions)
  const [customCaretaker, setCustomCaretaker] = useState("+91 98765 43210");
  const [addonBBQ, setAddonBBQ] = useState(true);
  const [addonBonfire, setAddonBonfire] = useState(false);
  const [addonDJ, setAddonDJ] = useState(false);

  // Load sent history logs
  useEffect(() => {
    if (booking?.id) {
      setHistoryLogs(getSentHistory(booking.id));
    }
  }, [booking?.id, deliveryStatus]);

  // Dynamic suggestion of templates based on booking status
  const suggestedTemplates = useMemo(() => {
    if (!booking) return [];
    return getSuggestedTemplates(booking.status, templates);
  }, [booking?.status, templates]);

  // Set default selected template
  useEffect(() => {
    if (suggestedTemplates.length > 0) {
      setSelectedTemplateId(suggestedTemplates[0].id);
    } else if (templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [suggestedTemplates]);

  // Re-generate AI content when template, tone, addons, or caretaker changes
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (activeTemplate && booking) {
      const addonText = [
        addonBBQ ? "BBQ Grill Grill Setup" : "",
        addonBonfire ? "Bonfire Pack Setup" : "",
        addonDJ ? "DJ Music sound" : "",
      ].filter(Boolean).join(", ") || "None";

      const aiContent = generateAIDynamicContent(activeTemplate, booking, aiTone, {
        FarmhouseName: farmhouse.name,
        CaretakerPhone: customCaretaker,
        Addons: addonText,
      });
      setMessageContent(aiContent);
    }
  }, [activeTemplate, booking, aiTone, addonBBQ, addonBonfire, addonDJ, customCaretaker, farmhouse.name]);

  const balance =
    Number(booking.agreed_total) - Number(booking.advance_paid) - Number(booking.discount);

  // Send Trigger Link
  const handleSendWhatsApp = () => {
    if (!messageContent) return;
    setIsSending(true);
    setDeliveryStatus("sending");

    // Mock API process
    setTimeout(() => {
      // Complete log creation
      const log = addSentHistoryLog({
        bookingId: booking.id,
        templateId: activeTemplate?.id || "custom",
        templateName: activeTemplate?.name || "Direct Message",
        recipientMobile: booking.mobile,
        recipientName: booking.customer_name,
        messageContent: messageContent,
        status: "Read", // simulated delivery status
      });

      if (log) {
        setHistoryLogs(getSentHistory(booking.id));
      }

      setIsSending(false);
      setDeliveryStatus("read");
      toast.success("WhatsApp message sent successfully!");
      
      // Open Web WhatsApp link
      const encodedMsg = encodeURIComponent(messageContent);
      window.open(`https://wa.me/91${booking.mobile}?text=${encodedMsg}`, "_blank");
    }, 1200);
  };

  // Schedule send
  const handleScheduleSend = () => {
    if (!scheduleTime) {
      toast.error("Please select a date and time to schedule.");
      return;
    }
    
    // Add to history as scheduled
    const log = addSentHistoryLog({
      bookingId: booking.id,
      templateId: activeTemplate?.id || "custom",
      templateName: activeTemplate?.name || "Scheduled Message",
      recipientMobile: booking.mobile,
      recipientName: booking.customer_name,
      messageContent: messageContent,
      status: "Sent",
      scheduledFor: scheduleTime,
    });

    if (log) {
      setHistoryLogs(getSentHistory(booking.id));
    }
    toast.success(`Message scheduled successfully for ${new Date(scheduleTime).toLocaleString()}`);
    setScheduleTime("");
  };

  // Resend template from history
  const handleResend = (log: SentHistoryLog) => {
    const encodedMsg = encodeURIComponent(log.messageContent);
    window.open(`https://wa.me/91${log.recipientMobile}?text=${encodedMsg}`, "_blank");
    toast.success("Resent via WhatsApp Web!");
  };

  const printReceipt = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${booking.order_id}</title>
      <style>
        body{font-family:Inter,sans-serif;padding:32px;color:#000;font-size:13px}
        h1{color:#1a237e;margin:0}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #1a237e;padding-bottom:12px;margin-bottom:16px}
        .logo{width:48px;height:48px;border-radius:50%;background:#f5a623;color:#1a237e;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        td{padding:6px;border-bottom:1px solid #eee}
        .label{color:#666;width:40%}
        .total{background:#f5f4ef;font-weight:bold}
        .stamp{margin-top:48px;border-top:1px dashed #999;padding-top:16px;text-align:right;color:#666}
      </style></head><body>
      <div class="hdr">
        <div style="display:flex;gap:12px;align-items:center"><div class="logo">16</div><div><h1>${farmhouse.name}</h1><div style="color:#666">${farmhouse.address ?? ""}</div><div style="color:#666">${farmhouse.phone ?? ""}</div></div></div>
        <div style="text-align:right"><div><strong>${booking.order_id}</strong></div><div style="color:#666">${formatDateIST(new Date().toISOString())}</div></div>
      </div>
      <h2 style="color:#1a237e;font-size:16px">Booking Receipt</h2>
      <table>
        <tr><td class="label">Customer</td><td>${booking.customer_name}</td></tr>
        <tr><td class="label">Mobile</td><td>+91 ${booking.mobile}</td></tr>
        <tr><td class="label">ID Proof</td><td>${booking.id_proof_type ?? "-"} ${booking.id_proof_number ?? ""}</td></tr>
        <tr><td class="label">Booking Date</td><td>${formatDateIST(booking.booking_date)}</td></tr>
        <tr><td class="label">Slot</td><td>${booking.slot?.name ?? "-"}</td></tr>
        <tr><td class="label">Guests</td><td>${booking.guests}</td></tr>
        <tr><td class="label">Agreed Total</td><td>${formatINR(booking.agreed_total)}</td></tr>
        <tr><td class="label">Advance Paid</td><td>${formatINR(booking.advance_paid)}</td></tr>
        <tr><td class="label">Discount</td><td>${formatINR(booking.discount)}</td></tr>
        <tr class="total"><td class="label">Balance Due</td><td>${formatINR(balance)}</td></tr>
      </table>
      ${farmhouse.notes ? `<p style="color:#666;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">${farmhouse.notes}</p>` : ""}
      <div class="stamp">Authorized Signature</div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const share = async () => {
    const text = `Booking ${booking.order_id} – ${booking.customer_name} – ${formatDateIST(booking.booking_date)} ${booking.slot?.name ?? ""} – Bal ${formatINR(balance)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  // Timeline check configurations based on status
  const currentStep = 
    booking.status === "Pending" ? 1 :
    booking.status === "Confirmed" ? 2 :
    booking.status === "Checked-In" ? 3 :
    booking.status === "Checked-Out" ? 4 : 2; // Cancelled is mapped separately

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${booking.order_id} — ${booking.customer_name}`}
      size="xl"
      footer={
        <div className="flex flex-wrap gap-2 justify-between w-full">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="font-semibold">Status Trigger:</span>
            <span className="rounded bg-navy/10 px-2 py-0.5 font-medium text-navy text-[10px]">
              {booking.status}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={share} className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/30">
              Copy Summary
            </button>
            <button
              onClick={printReceipt}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-sm text-white font-medium hover:bg-navy/90"
            >
              <Printer size={14} /> Print Receipt
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-sm">
        {/* Modern Hero Header Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-navy via-navy/95 to-[#1a237e] p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 h-40 w-40 bg-gold/10 rounded-full blur-2xl"></div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-gold bg-gold/20 px-2.5 py-1 rounded-full border border-gold/30">
                {booking.slot?.name || "Full Day Slot"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">{booking.customer_name}</h2>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <span>Ref: <strong className="text-white font-bold">{booking.order_id}</strong></span>
                <span>•</span>
                <span>Date: <strong className="text-white font-bold">{formatDateIST(booking.booking_date)}</strong></span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-300 uppercase block font-bold">Booking Status</span>
                <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase mt-1 ${
                  booking.status === 'Confirmed' ? 'bg-success text-white' :
                  booking.status === 'Pending' ? 'bg-gold text-navy' : 'bg-danger text-white'
                }`}>
                  {booking.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Area (7 cols): Customer Info, Addons, Timeline */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Primary Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Details */}
              <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2 pb-2 border-b border-border/50">
                  <User size={14} className="text-gold" /> Contact Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Name</label>
                    <span className="font-extrabold text-sm text-foreground">{booking.customer_name}</span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Mobile Number</label>
                    <a href={`tel:${booking.mobile}`} className="font-semibold text-sm text-navy hover:underline flex items-center gap-1.5 mt-0.5">
                      <Phone size={13} /> +91 {booking.mobile}
                    </a>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Verification ID</label>
                    <span className="font-medium text-xs text-foreground/80">
                      {booking.id_proof_type ? `${booking.id_proof_type} (${booking.id_proof_number})` : "No ID provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stay / Booking details */}
              <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2 pb-2 border-b border-border/50">
                  <Calendar size={14} className="text-gold" /> Stay Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Check-in Date</label>
                    <span className="font-extrabold text-sm text-foreground">{formatDateIST(booking.booking_date)}</span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Time Slot</label>
                    <span className="inline-flex items-center gap-1.5 font-bold text-xs mt-1 text-white px-2.5 py-0.5 rounded-full" style={{ backgroundColor: booking.slot?.color ?? "#888" }}>
                      <Clock size={11} /> {booking.slot?.name || "Full Day"}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block">Total Guest Count</label>
                    <span className="font-extrabold text-sm text-foreground">{booking.guests} Guests</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Journey Timeline */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2 pb-2 border-b border-border/50">
                <Activity size={14} className="text-gold" /> Booking Journey Timeline
              </h3>
              
              <div className="relative pl-8 space-y-6">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border/60"></div>

                {[
                  { step: 1, title: "Booking Created", desc: `Order Ref: ${booking.order_id}`, trigger: "Created" },
                  { step: 2, title: "Booking Confirmed", desc: `Status Trigger check: ${booking.status}`, trigger: "Confirmed" },
                  { step: 3, title: "Checked In at Farmhouse", desc: "Welcome message & rules delivered", trigger: "Checked-In" },
                  { step: 4, title: "Checked Out & Thank You", desc: "Feedback & review requests sent", trigger: "Checked-Out" }
                ].map((item) => {
                  const isDone = currentStep >= item.step;
                  const isActive = currentStep === item.step;
                  return (
                    <div key={item.step} className="relative flex gap-4">
                      <div className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                        isDone ? "bg-navy text-white border-navy font-bold" : "bg-card border-border text-muted-foreground"
                      } ${isActive ? "ring-4 ring-navy/15" : ""}`}>
                        {isDone ? <Check size={11} className="stroke-[3px]" /> : <span className="text-[10px] font-bold">{item.step}</span>}
                      </div>
                      <div className="space-y-0.5">
                        <div className={`text-xs font-black ${isDone ? "text-navy" : "text-muted-foreground"}`}>{item.title}</div>
                        <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {booking.notes && (
              <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-2 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2 pb-2 border-b border-border/50">
                  <FileText size={14} className="text-gold" /> Special Notes / Requests
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{booking.notes}</p>
              </div>
            )}

          </div>

          {/* Right Area (5 cols): Billing & WhatsApp panel */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Financial Summary */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-xs relative overflow-hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2 pb-2 border-b border-border/50">
                <CreditCard size={14} className="text-gold" /> Payment Breakdown
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-foreground/80">
                  <span>Agreed Total</span>
                  <span>{formatINR(booking.agreed_total)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-success">
                  <span>Advance Paid</span>
                  <span>{formatINR(booking.advance_paid)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-foreground/80">
                  <span>Discount Applied</span>
                  <span>{formatINR(booking.discount)}</span>
                </div>
                
                <div className={`flex items-center justify-between rounded-xl p-3.5 mt-3 ${
                  balance > 0 ? "bg-danger/5 border border-danger/10 text-danger" : "bg-success/5 border border-success/10 text-success"
                }`}>
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 block">Balance Outstanding</span>
                    {balance === 0 && <span className="text-[9px] bg-success/20 text-success px-1.5 py-0.5 rounded font-black uppercase">Paid In Full</span>}
                  </div>
                  <span className="text-lg font-black tracking-tight">{formatINR(balance)}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Engine Panel */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-xs relative overflow-hidden">
              <div className="absolute -top-3 -right-3 h-16 w-16 bg-success/5 rounded-bl-full flex items-center justify-end pr-5 pb-5">
                <MessageCircle className="text-success h-6 w-6 opacity-30" />
              </div>

              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
                  WhatsApp Center
                </h3>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[8px] font-black text-success uppercase tracking-wider">
                  Automated Engine
                </span>
              </div>

              {/* Template selector */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Select Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs focus:ring-1 focus:ring-navy focus:outline-none"
                >
                  <optgroup label={`Suggested for ${booking.status}`}>
                    {suggestedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Preset Templates">
                    {templates.filter(t => !suggestedTemplates.some(st => st.id === t.id)).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Dynamic Tone selector */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Sparkles size={11} className="text-gold" /> AI Tone Presets
                  </label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    {AI_TONES.map((tone) => (
                      <option key={tone.value} value={tone.value}>
                        {tone.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Priority</label>
                  <span className={`block py-1.5 px-2.5 text-xs font-black rounded-lg text-center ${
                    activeTemplate?.priority === "High" ? "bg-danger/10 text-danger" :
                    activeTemplate?.priority === "Medium" ? "bg-gold/10 text-gold-dark" : "bg-muted text-muted-foreground"
                  }`}>
                    {activeTemplate?.priority || "Medium"}
                  </span>
                </div>
              </div>

              {/* Msg Content Textbox */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Generated Content</label>
                  <span className="text-[8px] font-bold text-navy bg-navy/10 px-1 rounded">Live AI Optimizations</span>
                </div>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-input bg-card p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-success leading-relaxed"
                ></textarea>
              </div>

              {/* Delivery logs & sending action */}
              <div className="space-y-3">
                {deliveryStatus !== "idle" && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground font-medium">Status:</span>
                    <span className="font-extrabold flex items-center gap-1">
                      {deliveryStatus === "sending" && (
                        <span className="text-gold flex items-center gap-1"><Clock size={11} className="animate-spin" /> Transferring...</span>
                      )}
                      {deliveryStatus === "sent" && <span className="text-navy flex items-center gap-1"><Check size={11} /> Sent to WA</span>}
                      {deliveryStatus === "delivered" && <span className="text-success flex items-center gap-1"><CheckCheck size={11} /> Delivered</span>}
                      {deliveryStatus === "read" && <span className="text-success font-black flex items-center gap-1">Read ✔</span>}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={isSending || !messageContent}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-success py-2.5 text-xs font-bold text-white hover:bg-success/90 transition-all disabled:opacity-50"
                >
                  <Send size={13} /> {isSending ? "Processing..." : "Open WhatsApp Dispatch"}
                </button>
              </div>

              {/* Scheduling option */}
              <div className="border-t border-border/40 pt-3 space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground block">Queue Delayed Send</label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleScheduleSend}
                    className="rounded-lg bg-navy text-white text-xs font-bold px-4 hover:bg-navy/90"
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {/* Logs */}
              <div className="border-t border-border/40 pt-3 space-y-2.5 max-h-[140px] overflow-y-auto">
                <label className="text-[10px] uppercase font-bold text-muted-foreground block">Transmission Logs</label>
                {historyLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground text-[10px] py-1">
                    No recent transmission history.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-[10px] flex justify-between items-start">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-navy flex items-center gap-1">
                            {log.templateName}
                            {log.scheduledFor && <span className="text-[8px] bg-gold/20 text-gold-dark px-1 rounded">Delayed</span>}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {new Date(log.sentAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-success">{log.scheduledFor ? "Scheduled" : log.status}</span>
                          <button
                            type="button"
                            onClick={() => handleResend(log)}
                            className="text-navy hover:underline font-extrabold"
                          >
                            Resend
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
