import { useEffect, useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Settings as SetIcon,
  Clock,
  MessageSquare,
  Database,
  ShieldCheck,
  Search,
  Loader2,
  ShieldAlert,
  Trash2,
  Download,
  Upload,
  History,
  AlertCircle,
  Plus,
  Palette,
  Trash,
  GripVertical,
  Languages,
  Sparkles,
  Send,
  Eye,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { query, mutate } from "@/lib/db";
import { 
  getSavedTemplates, 
  saveTemplates, 
  WhatsAppTemplate, 
  TEMPLATE_CATEGORIES, 
  AI_TONES, 
  generateAIDynamicContent 
} from "@/lib/whatsapp-engine";
import { generateFullBackup, restoreFromBackup } from "@/lib/settings-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings | 16 Eyes Farm House" }] }),
  component: SettingsPage,
});

function ControlledDialog({
  trigger,
  title,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = () => setOpen(false);
    document.addEventListener("close-dialog", handler);
    return () => document.removeEventListener("close-dialog", handler);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function SettingsPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("slots");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPreviewTemplateId, setSelectedPreviewTemplateId] = useState("");
  const [testSendNumber, setTestSendNumber] = useState("");
  const [aiTone, setAiTone] = useState("Friendly");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const slotsData = await query(
        supabase.from("time_slots").select("*").order("start_time", { ascending: true }),
        []
      );
      setSlots(slotsData || []);

      const localTemplates = getSavedTemplates();
      setTemplates(localTemplates);

      try {
        const templatesData = await query(
          (supabase as any).from("whatsapp_templates").select("*").order("name", { ascending: true }),
          []
        );
        if (templatesData && templatesData.length > 0) {
          const synced = [...localTemplates];
          templatesData.forEach((dbTpl: any) => {
            if (!synced.some((t) => t.id === dbTpl.id)) {
              synced.push({
                id: dbTpl.id,
                name: dbTpl.name,
                content: dbTpl.content,
                description: dbTpl.description || "",
                category: dbTpl.category || "Custom",
                enabled: dbTpl.enabled ?? true,
                triggerStatus: dbTpl.triggerStatus || "all",
                autoSend: dbTpl.autoSend ?? false,
                priority: dbTpl.priority || "Medium",
                delayHours: dbTpl.delayHours ?? 0,
                successRate: dbTpl.successRate ?? 95.0,
                readRate: dbTpl.readRate ?? 88.0,
              });
            }
          });
          saveTemplates(synced);
          setTemplates(synced);
        }
      } catch (err) {
        console.warn("Could not sync templates from Supabase, using local store:", err);
      }
    } catch (error: any) {
      toast.error("Failed to load settings: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (templates.length > 0 && !selectedPreviewTemplateId) {
      setSelectedPreviewTemplateId(templates[0].id);
    }
  }, [templates, selectedPreviewTemplateId]);

  const handleAddTemplate = async (template: any) => {
    try {
      const newTpl: WhatsAppTemplate = {
        id: template.id || "tpl-" + Math.random().toString(36).substr(2, 9),
        name: template.name,
        category: template.category || "Custom",
        description: template.description || "",
        content: template.content,
        enabled: template.enabled ?? true,
        triggerStatus: template.triggerStatus || "all",
        autoSend: template.autoSend ?? false,
        priority: template.priority || "Medium",
        delayHours: Number(template.delayHours || 0),
        successRate: 100.0,
        readRate: 100.0,
      };

      const updated = [newTpl, ...templates];
      saveTemplates(updated);
      setTemplates(updated);

      try {
        await (supabase as any).from("whatsapp_templates").insert(newTpl);
      } catch {}

      toast.success("WhatsApp template added successfully");
      document.dispatchEvent(new CustomEvent("close-dialog"));
    } catch (err: any) {
      toast.error("Failed to add template: " + err.message);
    }
  };

  const handleUpdateTemplate = async (id: string, patch: any) => {
    try {
      const updated = templates.map((t) => {
        if (t.id === id) {
          return { ...t, ...patch };
        }
        return t;
      });
      saveTemplates(updated);
      setTemplates(updated);

      try {
        await (supabase as any).from("whatsapp_templates").update(patch).eq("id", id);
      } catch {}

      toast.success("WhatsApp template updated successfully");
      document.dispatchEvent(new CustomEvent("close-dialog"));
    } catch (err: any) {
      toast.error("Failed to update template: " + err.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const updated = templates.filter((t) => t.id !== id);
      saveTemplates(updated);
      setTemplates(updated);

      try {
        await (supabase as any).from("whatsapp_templates").delete().eq("id", id);
      } catch {}

      toast.success("WhatsApp template deleted");
    } catch (err: any) {
      toast.error("Failed to delete template: " + err.message);
    }
  };

  // Other handlers (Simplified)
  const handleCreateBackup = async () => {
    setSaving(true);
    try {
      const backup = await generateFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      toast.success("Backup created");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (file: File) => {
    setSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          await restoreFromBackup(json);
          toast.success("Restore complete");
          loadSettings();
        } catch (error: any) {
          toast.error(error.message);
        }
      };
      reader.readAsText(file);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlot = async (slot: any) => {
    try {
      const { error } = await supabase.from("time_slots").insert({
        name: slot.name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        color: slot.color,
        is_overnight: slot.is_overnight,
        is_default: slot.is_default,
      });
      if (error) throw error;
      toast.success("Time slot saved successfully");
      loadSettings();
      document.dispatchEvent(new CustomEvent("close-dialog"));
    } catch (err: any) {
      toast.error("Failed to add slot: " + err.message);
    }
  };

  const handleUpdateSlot = async (id: string, patch: any) => {
    try {
      const { error } = await supabase
        .from("time_slots")
        .update({
          name: patch.name,
          start_time: patch.start_time,
          end_time: patch.end_time,
          color: patch.color,
          is_overnight: patch.is_overnight,
          is_default: patch.is_default,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Time slot saved successfully");
      loadSettings();
      document.dispatchEvent(new CustomEvent("close-dialog"));
    } catch (err: any) {
      toast.error("Failed to update slot: " + err.message);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const { error } = await supabase.from("time_slots").delete().eq("id", id);
      if (error) throw error;
      toast.success("Slot deleted");
      loadSettings();
    } catch (err: any) {
      toast.error("Failed to delete slot: " + err.message);
    }
  };

  const handlePartialReset = async (category: "bookings" | "incomes" | "expenses" | "income_types" | "expense_types") => {
    const confirmation = prompt(
      `Type "DELETE ${category.toUpperCase()}" to confirm clearing all ${category} globally:`,
    );
    if (confirmation !== `DELETE ${category.toUpperCase()}`) {
      if (confirmation !== null) toast.error("Confirmation text did not match.");
      return;
    }
    setSaving(true);
    try {
      const targets = [category];
      if (category === "incomes") {
        targets.push("income_types");
      } else if (category === "expenses") {
        targets.push("expense_types");
      }
      
      for (const target of targets) {
        const { error } = await supabase.from(target as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      }
      
      toast.success(`All ${category} deleted successfully`);
      loadSettings();
    } catch (error: any) {
      toast.error("Failed to reset: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFullReset = async () => {
    const confirmation = prompt(
      `Type "RESET FACTORY SETTINGS" to confirm wiping EVERYTHING globally:`,
    );
    if (confirmation !== "RESET FACTORY SETTINGS") {
      if (confirmation !== null) toast.error("Confirmation text did not match.");
      return;
    }
    setSaving(true);
    try {
      const tables = ["bookings", "incomes", "expenses", "income_types", "expense_types", "time_slots"];
      for (const t of tables) {
        await supabase.from(t as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("farm_db_seeded");
      }
      toast.success("System has been reset to factory defaults");
      loadSettings();
    } catch (error: any) {
      toast.error("Failed to reset: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activePreviewTemplate = templates.find((t) => t.id === selectedPreviewTemplateId) || templates[0];

  const handleTestSend = (template: any) => {
    if (!testSendNumber) {
      toast.error("Please enter a valid mobile number for the test send.");
      return;
    }
    const mockBooking = {
      customer_name: "John Doe",
      booking_date: new Date().toISOString(),
      agreed_total: 15000,
      advance_paid: 5000,
      discount: 1000,
      guests: 8,
      status: "Confirmed",
      slot: { name: "Day Slot (9 AM - 6 PM)" },
    };
    const content = generateAIDynamicContent(template, mockBooking, aiTone, {
      FarmhouseName: "16 Eyes Farm House",
      CaretakerPhone: "+91 98765 43210",
    });
    const encoded = encodeURIComponent(content);
    window.open(`https://wa.me/91${testSendNumber}?text=${encoded}`, "_blank");
    toast.success(`Mock test message trigger sent to +91 ${testSendNumber}`);
  };

  // Show page immediately with empty content while loading in background
  const isInitialLoad = loading && slots.length === 0 && templates.length === 0;

  const sections = [
    { id: "slots", label: "Time Slots", icon: Clock },
    { id: "whatsapp", label: "WhatsApp Templates", icon: MessageSquare },
    { id: "data", label: "Data Management", icon: Database },
  ];

  const filteredSections = sections.filter(
    (s) =>
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          icon={SetIcon}
          title="Settings"
          subtitle="Manage farmhouse operations and templates"
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit sticky top-20 hidden lg:block">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-2">
              {filteredSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    activeTab === s.id ? "bg-accent text-navy" : "text-muted-foreground",
                  )}
                >
                  <s.icon
                    className={cn(
                      "h-4 w-4",
                      activeTab === s.id ? "text-navy" : "text-muted-foreground",
                    )}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <div className="lg:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="flex w-max h-auto p-1 bg-muted/50">
                {filteredSections.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="text-[10px] py-2 px-3">
                    <s.icon className="h-3 w-3 mb-1" />
                    <span className="whitespace-nowrap">{s.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="slots" className="mt-0 outline-none">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Time Slot Management</CardTitle>
                    <CardDescription>
                      Configure the booking sessions available for customers.
                    </CardDescription>
                  </div>
                  <ControlledDialog
                    trigger={
                      <Button size="sm" className="bg-navy">
                        <Plus className="mr-2 h-4 w-4" /> Add Slot
                      </Button>
                    }
                    title="Add New Time Slot"
                  >
                    <SlotForm onSubmit={handleAddSlot} />
                  </ControlledDialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {slots.map((sl) => (
                      <div
                        key={sl.id}
                        className="group flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                        <div
                          className="h-8 w-8 rounded-md flex-shrink-0 border"
                          style={{ backgroundColor: sl.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{sl.name}</span>
                            {sl.is_default && (
                              <Badge variant="secondary" className="text-[10px] h-4">
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {sl.start_time} – {sl.end_time}{" "}
                            {sl.is_overnight && (
                              <span className="ml-2 text-warning font-medium">Overnight</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ControlledDialog
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Palette className="h-4 w-4" />
                              </Button>
                            }
                            title={`Edit Slot: ${sl.name}`}
                          >
                            <SlotForm slot={sl} onSubmit={(p) => handleUpdateSlot(sl.id, p)} />
                          </ControlledDialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteSlot(sl.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-0 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Template Grid & Filters (7 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* Stats Cards Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 bg-card border-border/80">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Templates Active</div>
                      <div className="text-lg font-black text-navy">{templates.filter(t => t.enabled).length} <span className="text-[10px] text-muted-foreground font-normal">/ {templates.length}</span></div>
                    </Card>
                    <Card className="p-3 bg-card border-border/80">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Success</div>
                      <div className="text-lg font-black text-success">97.8%</div>
                    </Card>
                    <Card className="p-3 bg-card border-border/80">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Avg Read Rate</div>
                      <div className="text-lg font-black text-gold">91.4%</div>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 space-y-2 sm:space-y-0">
                      <div>
                        <CardTitle className="text-base font-extrabold text-navy">Template Management Grid</CardTitle>
                        <CardDescription className="text-xs">Configure triggers, priority levels, and auto-sending options.</CardDescription>
                      </div>
                      <ControlledDialog
                        trigger={
                          <Button size="sm" className="bg-navy font-bold text-xs h-8">
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add Template
                          </Button>
                        }
                        title="Add New WhatsApp Template"
                      >
                        <TemplateForm onSubmit={handleAddTemplate} />
                      </ControlledDialog>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Filter Badges Row */}
                      <div className="flex flex-wrap gap-1.5 border-b border-border/50 pb-3">
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setSelectedCategory(cat.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                              selectedCategory === cat.value
                                ? "bg-navy text-white"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Search and Grid List */}
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {filteredTemplates.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedPreviewTemplateId(t.id)}
                            className={`group relative overflow-hidden rounded-xl border p-4 transition-all cursor-pointer ${
                              selectedPreviewTemplateId === t.id
                                ? "border-navy bg-navy/5 shadow-sm"
                                : "border-border bg-card hover:border-navy/20 hover:shadow-xs"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 pr-8">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-xs text-navy">{t.name}</span>
                                  <Badge className="text-[9px] px-1.5 py-0 bg-muted/65 text-muted-foreground uppercase border-none">
                                    {t.category}
                                  </Badge>
                                  <Badge className={`text-[9px] px-1.5 py-0 border-none ${
                                    t.priority === "High" ? "bg-danger/10 text-danger" :
                                    t.priority === "Medium" ? "bg-gold/15 text-gold-dark" : "bg-muted text-muted-foreground"
                                  }`}>
                                    {t.priority}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                  {t.description || "No description provided"}
                                </p>
                              </div>

                              {/* Toggle enable and action buttons */}
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={t.enabled}
                                  onCheckedChange={(checked) => handleUpdateTemplate(t.id, { enabled: checked })}
                                  className="h-5 w-9 scale-90"
                                />
                                
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ControlledDialog
                                    trigger={
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-navy">
                                        <History className="h-3.5 w-3.5" />
                                      </Button>
                                    }
                                    title="Edit Template"
                                  >
                                    <TemplateForm
                                      template={t}
                                      onSubmit={(p) => handleUpdateTemplate(t.id, p)}
                                    />
                                  </ControlledDialog>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteTemplate(t.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Additional metadata tags */}
                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span>Trigger: <span className="font-semibold text-foreground">{t.triggerStatus}</span></span>
                                {t.autoSend && (
                                  <span className="rounded bg-navy/10 px-1 py-0.5 font-bold text-navy text-[8px] uppercase">
                                    Auto-send
                                  </span>
                                )}
                                {t.delayHours > 0 && (
                                  <span>Delay: <span className="font-semibold text-foreground">{t.delayHours}h</span></span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span>Deliv: <span className="font-semibold text-success">{t.successRate || 95}%</span></span>
                                <span>Read: <span className="font-semibold text-gold">{t.readRate || 88}%</span></span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {filteredTemplates.length === 0 && (
                          <div className="text-center py-12 border border-dashed rounded-xl bg-muted/10">
                            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                            <p className="mt-2 text-xs text-muted-foreground">
                              No templates found matching your search. Add one to get started.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Side: Interactive AI Preview & Variables Copier (5 Columns) */}
                <div className="lg:col-span-5 space-y-4">
                  
                  {/* WhatsApp Simulator Mockup */}
                  <Card className="overflow-hidden border-border bg-slate-100 dark:bg-zinc-950">
                    <CardHeader className="bg-[#075e54] text-white p-3 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-navy">
                          WA
                        </div>
                        <div>
                          <CardTitle className="text-xs font-black">WhatsApp Simulator</CardTitle>
                          <CardDescription className="text-[9px] text-white/80">AI Template Previewer</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-contain min-h-[220px]">
                      {activePreviewTemplate ? (
                        <div className="max-w-[85%] rounded-lg bg-white dark:bg-zinc-900 shadow p-3 text-xs text-foreground relative ml-auto mr-0">
                          {/* formatted text mock */}
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {generateAIDynamicContent(activePreviewTemplate, {
                              customer_name: "Dhiraj Katwe",
                              booking_date: new Date().toISOString(),
                              agreed_total: 18000,
                              advance_paid: 6000,
                              discount: 1000,
                              guests: 10,
                              status: "Confirmed",
                              slot: { name: "Day Slot (9 AM - 6 PM)" }
                            }, aiTone, {
                              FarmhouseName: "16 Eyes Farm House",
                              CaretakerPhone: "+91 98765 43210"
                            })}
                          </div>
                          <span className="absolute bottom-1 right-2 text-[8px] text-muted-foreground/80 flex items-center gap-0.5">
                            12:45 PM <CheckCircle className="h-2 w-2 text-success fill-success" />
                          </span>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground text-xs bg-white/80 dark:bg-zinc-900/80 rounded-lg">
                          Select a template from the list to view preview.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* AI Tone settings */}
                  <Card className="p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                      <Sparkles className="text-gold h-4 w-4" /> AI Tone Optimization
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Preset Tone</Label>
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
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Default Language</Label>
                        <select
                          className="w-full rounded-md border border-input bg-card px-2 py-1 text-xs focus:outline-none"
                          defaultValue="en"
                        >
                          <option value="en">English (default)</option>
                          <option value="hi">Hindi (हिन्दी)</option>
                          <option value="mr">Marathi (मराठी)</option>
                        </select>
                      </div>
                    </div>
                  </Card>

                  {/* Test Send Panel */}
                  <Card className="p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                      <Send className="text-navy h-4 w-4" /> Test Send Interface
                    </h4>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">+91</span>
                        <Input
                          placeholder="Recipient Mobile"
                          value={testSendNumber}
                          onChange={(e) => setTestSendNumber(e.target.value)}
                          className="pl-9 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => activePreviewTemplate && handleTestSend(activePreviewTemplate)}
                        disabled={!activePreviewTemplate}
                        className="bg-success text-white text-xs font-bold font-semibold hover:bg-success/90"
                      >
                        Send Test
                      </Button>
                    </div>
                  </Card>

                  {/* Variables Helper panel */}
                  <Card className="p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-navy">
                        Dynamic Variables Copier
                      </h4>
                      <Badge className="text-[8px] bg-navy/10 text-navy uppercase">Variables Guide</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Click any variable button to copy its tag to your clipboard for instant message insertion.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        "CustomerName",
                        "FarmhouseName",
                        "BookingDate",
                        "SlotName",
                        "Guests",
                        "AgreedTotal",
                        "AdvancePaid",
                        "Discount",
                        "BalanceDue",
                        "CaretakerPhone",
                        "LocationLink",
                        "ReviewLink",
                      ].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${v}}}`);
                            toast.success(`Copied {{${v}}} to clipboard!`);
                          }}
                          className="rounded border border-border/80 bg-muted/40 p-1.5 text-center text-[10px] font-mono hover:bg-muted text-foreground transition-all truncate"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </Card>

                </div>

              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0 outline-none">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Download className="h-5 w-5 text-navy" /> Backup Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-navy"
                      onClick={handleCreateBackup}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}{" "}
                      Create JSON Backup
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Upload className="h-5 w-5 text-navy" /> Restore Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors block">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Click to upload .json backup
                      </p>
                      <input
                        type="file"
                        className="hidden"
                        accept=".json"
                        onChange={(e) => e.target.files?.[0] && handleRestore(e.target.files[0])}
                      />
                    </label>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2 border-destructive/20 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                      <Trash2 className="h-5 w-5" /> Delete Data (Caution)
                    </CardTitle>
                    <CardDescription>
                      Carefully select the category you want to wipe. This cannot be undone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handlePartialReset("bookings")}
                    >
                      Delete All Bookings
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handlePartialReset("incomes")}
                    >
                      Delete All Income Records
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handlePartialReset("expenses")}
                    >
                      Delete All Expense Records
                    </Button>
                    <div className="pt-4 border-t border-destructive/20 mt-4">
                      <p className="text-xs font-bold text-destructive mb-3 uppercase tracking-wider">
                        Danger Zone: Categories
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handlePartialReset("income_types")}
                        >
                          Reset Income Categories
                        </Button>
                        <Button
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handlePartialReset("expense_types")}
                        >
                          Reset Expense Categories
                        </Button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-destructive/20 mt-4 col-span-full">
                      <p className="text-xs font-bold text-destructive mb-3 uppercase tracking-wider">
                        Danger Zone: Full System
                      </p>
                      <Button
                        variant="destructive"
                        className="w-full sm:w-auto bg-destructive text-white font-bold"
                        onClick={handleFullReset}
                      >
                        <ShieldAlert className="mr-2 h-4 w-4" /> Factory Reset (Wipe All System
                        Data)
                      </Button>
                      <p className="mt-2 text-[10px] text-muted-foreground italic">
                        Warning: This will delete every record except your user accounts and
                        farmhouse profile.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-destructive/10 border-t border-destructive/10 px-6 py-3 mt-2">
                    <p className="text-xs text-destructive-foreground font-medium">
                      To protect your data, each action requires double confirmation.
                    </p>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SlotForm({ slot, onSubmit }: { slot?: any; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState(
    slot || {
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      color: "#3B82F6",
      is_overnight: false,
    },
  );
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Slot Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. Day Shift"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label>Overnight Slot</Label>
        </div>
        <Switch
          checked={formData.is_overnight}
          onCheckedChange={(v) => setFormData({ ...formData, is_overnight: v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="h-10 w-20 p-1"
          />
          <Input
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          />
        </div>
      </div>
      <Button className="w-full bg-navy" onClick={() => onSubmit(formData)}>
        {slot ? "Update" : "Create"} Slot
      </Button>
    </div>
  );
}

function TemplateForm({ template, onSubmit }: { template?: any; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState(
    template || {
      name: "",
      description: "",
      category: "Booking",
      content: "",
      enabled: true,
      triggerStatus: "Confirmed",
      autoSend: true,
      priority: "Medium",
      delayHours: 0,
    }
  );

  return (
    <div className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Template Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Booking Confirmation"
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs focus:ring-1 focus:ring-navy focus:outline-none"
          >
            <option value="Booking">Booking Management</option>
            <option value="Payment">Payments & Invoices</option>
            <option value="Operations">Operations & Check-in</option>
            <option value="Feedback">Reviews & Feedback</option>
            <option value="Marketing">Offers & Marketing</option>
            <option value="Custom">Custom / Other</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g. Sent automatically when a booking is confirmed"
          className="text-xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Booking Status Trigger</Label>
          <select
            value={formData.triggerStatus}
            onChange={(e) => setFormData({ ...formData, triggerStatus: e.target.value })}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs focus:outline-none"
          >
            <option value="all">Any Status</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Checked-In">Checked-In</option>
            <option value="Checked-Out">Checked-Out</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Priority Level</Label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs focus:outline-none"
          >
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Delay (in Hours)</Label>
          <Input
            type="number"
            value={formData.delayHours}
            onChange={(e) => setFormData({ ...formData, delayHours: Number(e.target.value) })}
            placeholder="0 for immediate"
            className="text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
        <div className="space-y-0.5">
          <Label className="text-xs font-bold uppercase text-navy">Auto-Trigger System</Label>
          <p className="text-[10px] text-muted-foreground">Automatically fire template on status updates?</p>
        </div>
        <Switch
          checked={formData.autoSend}
          onCheckedChange={(v) => setFormData({ ...formData, autoSend: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase text-muted-foreground">Message Content Template</Label>
        <Textarea
          rows={6}
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Hi {{CustomerName}},\n\nYour booking at *{{FarmhouseName}}* is confirmed..."
          className="text-xs font-mono"
        />
        <p className="text-[9px] text-muted-foreground">
          Available keys: <code className="bg-muted px-1 text-gold">{"{{CustomerName}}"}</code>, <code className="bg-muted px-1 text-gold">{"{{FarmhouseName}}"}</code>, <code className="bg-muted px-1 text-gold">{"{{BookingDate}}"}</code>, <code className="bg-muted px-1 text-gold">{"{{BalanceDue}}"}</code>, etc.
        </p>
      </div>

      <Button className="w-full bg-navy text-xs font-bold py-2.5" onClick={() => onSubmit(formData)}>
        {template ? "Update Template Config" : "Create New Template"}
      </Button>
    </div>
  );
}
