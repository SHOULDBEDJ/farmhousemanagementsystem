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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 text-sm">
        
        {/* Left Side: Booking & Customer Details + Timeline */}
        <div className="md:col-span-7 space-y-5 pr-0 md:pr-4 md:border-r border-border">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Customer Information Card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User size={13} className="text-gold" /> Customer Information
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Full Name</span>
                  <span className="font-semibold">{booking.customer_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Mobile</span>
                  <span className="font-medium text-navy flex items-center gap-1">
                    <Phone size={11} /> +91 {booking.mobile}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground text-xs">ID Verification</span>
                  <span className="text-xs font-medium">
                    {booking.id_proof_type ? `${booking.id_proof_type} (${booking.id_proof_number})` : "Not provided"}
                  </span>
                </div>
              </div>
            </div>

            {/* Booking Details Card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar size={13} className="text-gold" /> Booking Information
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Booking Date</span>
                  <span className="font-semibold">{formatDateIST(booking.booking_date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Time Slot</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] text-white font-semibold"
                    style={{ backgroundColor: booking.slot?.color ?? "#888" }}
                  >
                    {booking.slot?.name || "Full Day"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground text-xs">Total Guests</span>
                  <span className="font-semibold">{booking.guests} Guests</span>
                </div>
              </div>
            </div>
          </div>

          {/* Add-On Services Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Layers size={13} className="text-gold" /> Add-On Services
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={addonBBQ}
                  onChange={(e) => setAddonBBQ(e.target.checked)}
                  className="rounded text-navy focus:ring-navy"
                />
                <span className="text-xs font-medium">BBQ Grill Setup</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={addonBonfire}
                  onChange={(e) => setAddonBonfire(e.target.checked)}
                  className="rounded text-navy focus:ring-navy"
                />
                <span className="text-xs font-medium">Bonfire Package</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={addonDJ}
                  onChange={(e) => setAddonDJ(e.target.checked)}
                  className="rounded text-navy focus:ring-navy"
                />
                <span className="text-xs font-medium">DJ & Music sound</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Caretaker Phone:</span>
              <input
                type="text"
                value={customCaretaker}
                onChange={(e) => setCustomCaretaker(e.target.value)}
                placeholder="Caretaker Mobile"
                className="w-full max-w-[200px] rounded-md border border-input bg-card px-2 py-1 text-xs"
              />
            </div>
          </div>

          {/* Booking Timeline */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Activity size={13} className="text-gold" /> Booking Journey Timeline
            </h4>
            
            <div className="relative pl-6 space-y-4">
              {/* Vertical timeline line */}
              <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-border"></div>

              {/* Step 1: Created */}
              <div className="relative flex gap-3">
                <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border ${currentStep >= 1 ? "bg-navy text-white border-navy" : "bg-card border-border"}`}>
                  <Check size={10} />
                </div>
                <div>
                  <div className="text-xs font-bold">Booking Created</div>
                  <div className="text-[10px] text-muted-foreground">Order Ref: {booking.order_id}</div>
                </div>
              </div>

              {/* Step 2: Confirmed */}
              <div className="relative flex gap-3">
                <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border ${currentStep >= 2 ? "bg-navy text-white border-navy" : "bg-card border-border"}`}>
                  {currentStep >= 2 ? <Check size={10} /> : <span className="text-[9px]">2</span>}
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    Booking Confirmed
                    {booking.status === "Cancelled" && (
                      <span className="text-[10px] text-danger font-medium">(CANCELLED)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Status Trigger check: {booking.status}</div>
                </div>
              </div>

              {/* Step 3: Checked In */}
              <div className="relative flex gap-3">
                <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border ${currentStep >= 3 ? "bg-navy text-white border-navy" : "bg-card border-border"}`}>
                  {currentStep >= 3 ? <Check size={10} /> : <span className="text-[9px]">3</span>}
                </div>
                <div>
                  <div className="text-xs font-bold">Checked In at Farmhouse</div>
                  <div className="text-[10px] text-muted-foreground">Welcome message and rules delivered</div>
                </div>
              </div>

              {/* Step 4: Checked Out */}
              <div className="relative flex gap-3">
                <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border ${currentStep >= 4 ? "bg-navy text-white border-navy" : "bg-card border-border"}`}>
                  {currentStep >= 4 ? <Check size={10} /> : <span className="text-[9px]">4</span>}
                </div>
                <div>
                  <div className="text-xs font-bold">Checked Out & Thank You</div>
                  <div className="text-[10px] text-muted-foreground">Feedback & review requests sent</div>
                </div>
              </div>
            </div>
          </div>

          {booking.notes && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText size={13} className="text-gold" /> Special Notes
              </h4>
              <p className="text-muted-foreground text-xs">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Right Side: Payment summary & WhatsApp Automation Panel */}
        <div className="md:col-span-5 space-y-4">
          
          {/* Payment Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <CreditCard size={13} className="text-gold" /> Payment Breakdown
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Agreed Total</span>
                <span>{formatINR(booking.agreed_total)}</span>
              </div>
              <div className="flex justify-between text-xs text-success font-medium">
                <span>Advance Paid</span>
                <span>{formatINR(booking.advance_paid)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Discount Applied</span>
                <span>{formatINR(booking.discount)}</span>
              </div>
              <div
                className={`flex justify-between rounded-lg p-2.5 ${balance > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
              >
                <span className="font-bold text-xs">Balance Outstanding</span>
                <span className="font-extrabold text-sm">{formatINR(balance)}</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Communication Panel */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 bg-success/5 rounded-bl-full flex items-center justify-end pr-3 pb-3">
              <MessageCircle className="text-success h-5 w-5 opacity-40" />
            </div>

            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy">
                WhatsApp Communication Panel
              </h4>
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-[8px] font-bold text-success uppercase">
                Active Engine
              </span>
            </div>

            {/* Template Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Template Type</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-xs focus:ring-1 focus:ring-navy focus:outline-none"
              >
                <optgroup label={`Suggested for ${booking.status}`}>
                  {suggestedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other Templates">
                  {templates.filter(t => !suggestedTemplates.some(st => st.id === t.id)).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Tone Selector */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Sparkles size={9} className="text-gold" /> AI Tone Selection
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-2 py-1 text-xs focus:outline-none"
                >
                  {AI_TONES.map((tone) => (
                    <option key={tone.value} value={tone.value}>
                      {tone.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Priority</label>
                <span className={`block py-1 px-2 text-xs font-semibold rounded text-center ${
                  activeTemplate?.priority === "High" ? "bg-danger/10 text-danger" :
                  activeTemplate?.priority === "Medium" ? "bg-gold/15 text-gold-dark" : "bg-muted text-muted-foreground"
                }`}>
                  {activeTemplate?.priority || "Medium"} Priority
                </span>
              </div>
            </div>

            {/* Message Editing Box */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">AI Dynamic Content Preview</label>
                <span className="text-[8px] text-muted-foreground">Variables auto-injected</span>
              </div>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-card p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-success"
              ></textarea>
            </div>

            {/* Delivery simulator */}
            {deliveryStatus !== "idle" && (
              <div className="flex items-center justify-between rounded bg-muted/30 p-2 text-xs">
                <span className="text-muted-foreground">Delivery Status:</span>
                <span className="font-semibold flex items-center gap-1">
                  {deliveryStatus === "sending" && (
                    <span className="flex items-center gap-1 text-gold"><Clock size={12} className="animate-spin" /> Sending...</span>
                  )}
                  {deliveryStatus === "sent" && (
                    <span className="flex items-center gap-1 text-navy"><Check size={12} /> Sent</span>
                  )}
                  {deliveryStatus === "delivered" && (
                    <span className="flex items-center gap-1 text-success"><CheckCheck size={12} /> Delivered</span>
                  )}
                  {deliveryStatus === "read" && (
                    <span className="flex items-center gap-1 text-success-dark font-extrabold"><CheckCheck size={12} className="text-success-dark" /> Read ✔</span>
                  )}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={isSending || !messageContent}
                className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-lg bg-success py-2 text-xs font-bold text-white hover:bg-success/90 disabled:opacity-50"
              >
                <Send size={12} /> {isSending ? "Sending..." : "Send via WhatsApp"}
              </button>
            </div>

            {/* Scheduled send option */}
            <div className="border-t border-border/60 pt-3 mt-2 space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Schedule Send Option</label>
              <div className="flex gap-1.5">
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-card px-2 py-1 text-[11px] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleScheduleSend}
                  className="rounded bg-navy text-white text-[11px] px-3 font-semibold hover:bg-navy/90"
                >
                  Schedule
                </button>
              </div>
            </div>

            {/* Delivery Logs History */}
            <div className="border-t border-border/60 pt-3 mt-2 space-y-2 max-h-[140px] overflow-y-auto">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Communication History Logs</label>
              {historyLogs.length === 0 ? (
                <div className="text-center text-muted-foreground text-[10px] py-2">
                  No message history logs found.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="rounded border border-border/50 bg-muted/10 p-2 text-[10px] flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-1">
                          {log.templateName}
                          {log.scheduledFor && (
                            <span className="text-[8px] bg-gold/15 text-gold-dark px-1 rounded">Scheduled</span>
                          )}
                        </div>
                        <div className="text-[8px] text-muted-foreground">
                          {new Date(log.sentAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-success-dark">
                          {log.scheduledFor ? "Scheduled" : log.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResend(log)}
                          className="text-navy hover:underline font-bold"
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
    </Modal>
  );
}
