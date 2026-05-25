export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "Booking" | "Payment" | "Marketing" | "Operations" | "Feedback" | "Custom";
  description: string;
  content: string;
  enabled: boolean;
  triggerStatus: "all" | "Confirmed" | "Pending" | "Cancelled" | "Checked-Out" | "Checked-In";
  autoSend: boolean;
  priority: "High" | "Medium" | "Low";
  delayHours: number; // 0 for immediate
  successRate: number; // mock analytics
  readRate: number; // mock analytics
}

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "booking-confirm",
    name: "Booking Confirmation",
    category: "Booking",
    description: "Sent automatically when a booking is confirmed",
    content: "Hi {{CustomerName}},\n\nYour booking at *{{FarmhouseName}}* is *CONFIRMED* for {{BookingDate}} ({{SlotName}}).\n\nGuests: {{Guests}}\nAdvance Paid: {{AdvancePaid}}\nBalance Due: {{BalanceDue}}\n\nWe look forward to hosting you!",
    enabled: true,
    triggerStatus: "Confirmed",
    autoSend: true,
    priority: "High",
    delayHours: 0,
    successRate: 98.4,
    readRate: 95.2,
  },
  {
    id: "booking-pending",
    name: "Booking Pending",
    category: "Booking",
    description: "Sent when a slot reservation is pending verification",
    content: "Hi {{CustomerName}},\n\nThank you for choosing *{{FarmhouseName}}*. Your reservation request for {{BookingDate}} ({{SlotName}}) is received and is currently *PENDING* approval.\n\nOur team will contact you shortly to confirm.",
    enabled: true,
    triggerStatus: "Pending",
    autoSend: true,
    priority: "Medium",
    delayHours: 0,
    successRate: 96.8,
    readRate: 89.1,
  },
  {
    id: "payment-confirm",
    name: "Payment Confirmation",
    category: "Payment",
    description: "Sent when a payment is received successfully",
    content: "Hello {{CustomerName}},\n\nWe have successfully received your payment of {{AdvancePaid}} for your stay on {{BookingDate}}.\n\nUpdated Booking details:\nAgreed Total: {{AgreedTotal}}\nBalance Due: {{BalanceDue}}\n\nThank you!",
    enabled: true,
    triggerStatus: "Confirmed",
    autoSend: true,
    priority: "High",
    delayHours: 0,
    successRate: 99.1,
    readRate: 97.4,
  },
  {
    id: "payment-reminder",
    name: "Payment Reminder",
    category: "Payment",
    description: "Sent to request the outstanding balance",
    content: "Dear {{CustomerName}},\n\nThis is a friendly reminder regarding your upcoming stay at *{{FarmhouseName}}* on {{BookingDate}}.\n\nOutstanding Balance: *{{BalanceDue}}*\n\nPlease process the payment at your earliest convenience. See you soon!",
    enabled: true,
    triggerStatus: "Pending",
    autoSend: false,
    priority: "High",
    delayHours: 24,
    successRate: 94.5,
    readRate: 88.0,
  },
  {
    id: "booking-cancel",
    name: "Booking Cancellation",
    category: "Booking",
    description: "Sent when a booking is cancelled",
    content: "Hello {{CustomerName}},\n\nYour booking at *{{FarmhouseName}}* for {{BookingDate}} has been *CANCELLED*.\n\nIf you are eligible for a refund, our team will process it within 3-5 business days. Please contact us for questions.",
    enabled: true,
    triggerStatus: "Cancelled",
    autoSend: true,
    priority: "High",
    delayHours: 0,
    successRate: 97.2,
    readRate: 93.5,
  },
  {
    id: "refund-confirm",
    name: "Refund Confirmation",
    category: "Payment",
    description: "Sent when a refund is processed",
    content: "Dear {{CustomerName}},\n\nWe have processed a refund of {{RefundAmount}} for your cancelled booking at *{{FarmhouseName}}* on {{BookingDate}}.\n\nIt should reflect in your account shortly.",
    enabled: true,
    triggerStatus: "Cancelled",
    autoSend: false,
    priority: "Medium",
    delayHours: 0,
    successRate: 98.0,
    readRate: 92.8,
  },
  {
    id: "checkin-reminder",
    name: "Check-In Reminder & Location",
    category: "Operations",
    description: "Sent 24 hours before check-in time",
    content: "Hi {{CustomerName}},\n\nReady for your getaway tomorrow? 🏡\n\n*Farmhouse:* {{FarmhouseName}}\n*Date:* {{BookingDate}} ({{SlotName}})\n*Location:* {{LocationLink}}\n*Caretaker Contact:* {{CaretakerPhone}}\n\n*House Rules:* Please review rules regarding music timings and cleanliness at check-in.",
    enabled: true,
    triggerStatus: "Confirmed",
    autoSend: true,
    priority: "High",
    delayHours: 24,
    successRate: 96.1,
    readRate: 91.3,
  },
  {
    id: "welcome-msg",
    name: "Welcome Message",
    category: "Operations",
    description: "Sent right at check-in time",
    content: "Welcome to *{{FarmhouseName}}*, {{CustomerName}}! 👋\n\nWe hope you have an incredible stay. If you need any assistance with BBQ setups, pool setup, or bonfire services, please ask the caretaker at {{CaretakerPhone}}.\n\nEnjoy your stay!",
    enabled: true,
    triggerStatus: "Checked-In",
    autoSend: true,
    priority: "Medium",
    delayHours: 0,
    successRate: 97.5,
    readRate: 95.0,
  },
  {
    id: "checkout-reminder",
    name: "Checkout Reminder",
    category: "Operations",
    description: "Sent 2 hours before scheduled checkout",
    content: "Hi {{CustomerName}},\n\nWe hope you enjoyed your time at *{{FarmhouseName}}*!\n\nThis is a quick reminder that checkout time is in 2 hours. Our caretaker will assist you with luggage and a quick room check.",
    enabled: true,
    triggerStatus: "Checked-In",
    autoSend: true,
    priority: "Medium",
    delayHours: 2,
    successRate: 95.9,
    readRate: 92.4,
  },
  {
    id: "thankyou-review",
    name: "Thank You & Review Request",
    category: "Feedback",
    description: "Sent 4 hours after checkout",
    content: "Hi {{CustomerName}},\n\nThank you for staying at *{{FarmhouseName}}*! It was a pleasure hosting you.\n\nCould you please take 1 minute to share your feedback or rate us here?\n{{ReviewLink}}\n\nIt helps us improve our guest services!",
    enabled: true,
    triggerStatus: "Checked-Out",
    autoSend: true,
    priority: "Medium",
    delayHours: 4,
    successRate: 92.0,
    readRate: 85.6,
  },
  {
    id: "weekend-offer",
    name: "Weekend Special Deal",
    category: "Marketing",
    description: "Promotion sent to past guests for upcoming weekend",
    content: "Hey {{CustomerName}}!\n\nLooking for weekend plans? 🏊‍♂️\n\nBook this upcoming weekend at *{{FarmhouseName}}* and receive a complimentary *BBQ + Bonfire Package* worth ₹2,500!\n\nReply directly to block the dates.",
    enabled: true,
    triggerStatus: "all",
    autoSend: false,
    priority: "Low",
    delayHours: 0,
    successRate: 89.4,
    readRate: 74.2,
  },
  {
    id: "bbq-addon",
    name: "BBQ & Bonfire Package",
    category: "Marketing",
    description: "Promoting add-on service details to confirmed bookings",
    content: "Hi {{CustomerName}},\n\nMake your stay at *{{FarmhouseName}}* extra cozy!\n\nUpgrade your booking to include our *Bonfire & BBQ Grill Setup* for just ₹1,200 (includes coal, skewers, and setup).\n\nLet us know if we should add it!",
    enabled: true,
    triggerStatus: "Confirmed",
    autoSend: false,
    priority: "Low",
    delayHours: 48,
    successRate: 91.2,
    readRate: 83.9,
  },
];

export const AI_TONES = [
  { value: "Professional", label: "Professional & Polished" },
  { value: "Friendly", label: "Warm & Friendly" },
  { value: "Urgent", label: "Urgent & Direct" },
  { value: "Warm", label: "Warm & Welcoming" },
  { value: "Funny", label: "Playful & Casual" },
];

export const TEMPLATE_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "Booking", label: "Booking Management" },
  { value: "Payment", label: "Payments & Invoices" },
  { value: "Operations", label: "Check-in & Rules" },
  { value: "Feedback", label: "Reviews & Surveys" },
  { value: "Marketing", label: "Offers & Promotions" },
];

// Helper to load templates from localStorage (fallback to defaults if empty)
export function getSavedTemplates(): WhatsAppTemplate[] {
  try {
    const saved = localStorage.getItem("ldb_whatsapp_automation_templates");
    if (saved) return JSON.parse(saved);
    localStorage.setItem("ldb_whatsapp_automation_templates", JSON.stringify(DEFAULT_TEMPLATES));
    return DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

// Helper to save templates
export function saveTemplates(templates: WhatsAppTemplate[]) {
  try {
    localStorage.setItem("ldb_whatsapp_automation_templates", JSON.stringify(templates));
  } catch (err) {
    console.error("Failed to save templates:", err);
  }
}

// WhatsApp Template Intelligence Engine: Maps booking status to suggested template types
export function getSuggestedTemplates(bookingStatus: string, allTemplates: WhatsAppTemplate[]): WhatsAppTemplate[] {
  const enabled = allTemplates.filter((t) => t.enabled);
  
  // Custom filter logic
  if (bookingStatus === "Confirmed") {
    return enabled.filter((t) => ["booking-confirm", "payment-confirm", "checkin-reminder", "bbq-addon"].includes(t.id) || t.triggerStatus === "Confirmed");
  }
  if (bookingStatus === "Pending") {
    return enabled.filter((t) => ["booking-pending", "payment-reminder"].includes(t.id) || t.triggerStatus === "Pending");
  }
  if (bookingStatus === "Cancelled") {
    return enabled.filter((t) => ["booking-cancel", "refund-confirm"].includes(t.id) || t.triggerStatus === "Cancelled");
  }
  if (bookingStatus === "Checked-In") {
    return enabled.filter((t) => ["welcome-msg", "checkout-reminder"].includes(t.id) || t.triggerStatus === "Checked-In");
  }
  if (bookingStatus === "Checked-Out") {
    return enabled.filter((t) => ["thankyou-review"].includes(t.id) || t.triggerStatus === "Checked-Out");
  }
  
  // Marketing/All status
  return enabled.filter((t) => t.triggerStatus === "all" || t.category === "Marketing");
}

// AI Message Optimization Engine
export function generateAIDynamicContent(
  template: WhatsAppTemplate,
  booking: any,
  tone: string,
  customVars: Record<string, string> = {}
): string {
  let content = template.content;

  // Variables mapping
  const balance = Number(booking.agreed_total || 0) - Number(booking.advance_paid || 0) - Number(booking.discount || 0);
  const vars: Record<string, string> = {
    CustomerName: booking.customer_name || "Valued Guest",
    FarmhouseName: customVars.FarmhouseName || "16 Eyes Farm House",
    BookingDate: booking.booking_date ? new Date(booking.booking_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "your selected date",
    SlotName: booking.slot?.name || "Full Day",
    Guests: String(booking.guests || 1),
    AgreedTotal: `₹${(booking.agreed_total || 0).toLocaleString("en-IN")}`,
    AdvancePaid: `₹${(booking.advance_paid || 0).toLocaleString("en-IN")}`,
    Discount: `₹${(booking.discount || 0).toLocaleString("en-IN")}`,
    BalanceDue: `₹${balance.toLocaleString("en-IN")}`,
    RefundAmount: `₹${(booking.advance_paid || 0).toLocaleString("en-IN")}`,
    LocationLink: "https://maps.google.com/?q=16+Eyes+Farm+House+Karjat",
    CaretakerPhone: "+91 98765 43210",
    ReviewLink: "https://g.page/16eyes-farmhouse/review",
    ...customVars,
  };

  // Replace standard variables
  for (const [k, v] of Object.entries(vars)) {
    const regex = new RegExp(`{{\\s*${k}\\s*}}`, "g");
    content = content.replace(regex, v);
  }

  // Adjust message based on tone selection
  if (tone === "Friendly") {
    content = "✨ Hey there! " + content + " \n\nLooking forward to having an absolute blast together! Let us know if you need anything at all. 😊🌈";
  } else if (tone === "Urgent") {
    content = "⚠️ *IMPORTANT ACTION REQUIRED* \n\n" + content + " \n\nPlease complete this as soon as possible to ensure reservation safety.";
  } else if (tone === "Warm") {
    content = "🌸 Warmest greetings! " + content + " \n\nMay your stay be filled with peaceful moments and wonderful family memories. 🏡💖";
  } else if (tone === "Funny") {
    content = "😎 Hold on to your hats! " + content + " \n\nPrepare for pool splashes, legendary BBQ, and maximum relaxation mode! 🏊‍♂️🍔";
  }

  return content;
}

// Log sent history to localStorage
export interface SentHistoryLog {
  id: string;
  bookingId: string;
  templateId: string;
  templateName: string;
  recipientMobile: string;
  recipientName: string;
  messageContent: string;
  sentAt: string;
  status: "Sent" | "Delivered" | "Read" | "Failed";
  scheduledFor?: string;
}

export function getSentHistory(bookingId: string): SentHistoryLog[] {
  try {
    const logs = JSON.parse(localStorage.getItem("ldb_whatsapp_sent_logs") || "[]");
    return logs.filter((log: any) => log.bookingId === bookingId);
  } catch {
    return [];
  }
}

export function addSentHistoryLog(log: Omit<SentHistoryLog, "id" | "sentAt">) {
  try {
    const logs = JSON.parse(localStorage.getItem("ldb_whatsapp_sent_logs") || "[]");
    const newLog: SentHistoryLog = {
      ...log,
      id: "log-" + Math.random().toString(36).substr(2, 9),
      sentAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    localStorage.setItem("ldb_whatsapp_sent_logs", JSON.stringify(logs));
    return newLog;
  } catch (err) {
    console.error("Failed to add log:", err);
    return null;
  }
}
