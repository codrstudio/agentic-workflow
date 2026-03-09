import { useState, useMemo, useCallback, useEffect } from "react";
import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";

type ScheduleType = "interval" | "daily" | "weekly" | "monthly" | "custom";

interface CronScheduleBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
] as const;

function detectType(cron: string): ScheduleType {
  if (!cron) return "daily";
  const parts = cron.split(" ");
  if (parts.length !== 5) return "custom";

  const [min, hour, dom, , dow] = parts;

  // Interval: */N * * * * or 0 */N * * *
  if (min?.startsWith("*/") && hour === "*" && dom === "*" && dow === "*") return "interval";
  if (min === "0" && hour?.startsWith("*/") && dom === "*" && dow === "*") return "interval";

  // Monthly: M H D * *
  if (dow === "*" && dom !== "*" && !dom?.includes("/") && !dom?.includes(",")) return "monthly";

  // Weekly: M H * * D (D is not *)
  if (dow !== "*" && dom === "*") return "weekly";

  // Daily: M H * * *
  if (dom === "*" && dow === "*" && !min?.includes("/") && !hour?.includes("/")) return "daily";

  return "custom";
}

function parseTimeFromCron(cron: string): { hour: string; minute: string } {
  const parts = cron.split(" ");
  const min = parts[0] ?? "0";
  const hr = parts[1] ?? "9";
  return {
    hour: hr === "*" ? "09" : hr.padStart(2, "0"),
    minute: min === "*" ? "00" : min.padStart(2, "0"),
  };
}

function parseInterval(cron: string): { value: number; unit: "minutes" | "hours" } {
  const parts = cron.split(" ");
  const min = parts[0] ?? "";
  const hour = parts[1] ?? "";

  if (min.startsWith("*/")) {
    const n = parseInt(min.slice(2), 10);
    return { value: isNaN(n) ? 5 : n, unit: "minutes" };
  }
  if (hour.startsWith("*/")) {
    const n = parseInt(hour.slice(2), 10);
    return { value: isNaN(n) ? 1 : n, unit: "hours" };
  }
  return { value: 5, unit: "minutes" };
}

function parseWeekdays(cron: string): number[] {
  const parts = cron.split(" ");
  const dow = parts[4] ?? "*";
  if (dow === "*") return [1, 2, 3, 4, 5];
  return dow.split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
}

function parseDayOfMonth(cron: string): number {
  const parts = cron.split(" ");
  const dom = parts[2] ?? "1";
  const n = parseInt(dom, 10);
  return isNaN(n) ? 1 : n;
}

function describeCron(expr: string): string | null {
  try {
    return cronstrue.toString(expr, { locale: "pt_BR", use24HourTimeFormat: true });
  } catch {
    return null;
  }
}

function getNextExecutions(expr: string, count: number): Date[] {
  try {
    const cron = CronExpressionParser.parse(expr);
    const results: Date[] = [];
    for (let i = 0; i < count; i++) {
      results.push(cron.next().toDate());
    }
    return results;
  } catch {
    return [];
  }
}

function isValidCron(expr: string): boolean {
  try {
    CronExpressionParser.parse(expr);
    return true;
  } catch {
    return false;
  }
}

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
  const [type, setType] = useState<ScheduleType>(() => detectType(value));
  const [intervalValue, setIntervalValue] = useState(() => parseInterval(value).value);
  const [intervalUnit, setIntervalUnit] = useState<"minutes" | "hours">(() => parseInterval(value).unit);
  const [hour, setHour] = useState(() => parseTimeFromCron(value).hour);
  const [minute, setMinute] = useState(() => parseTimeFromCron(value).minute);
  const [weekdays, setWeekdays] = useState<number[]>(() => parseWeekdays(value));
  const [dayOfMonth, setDayOfMonth] = useState(() => parseDayOfMonth(value));
  const [customExpr, setCustomExpr] = useState(value || "");
  const [customError, setCustomError] = useState<string | null>(null);

  const buildCron = useCallback((): string => {
    switch (type) {
      case "interval":
        if (intervalUnit === "minutes") return `*/${intervalValue} * * * *`;
        return `0 */${intervalValue} * * *`;
      case "daily":
        return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
      case "weekly": {
        const days = weekdays.length > 0 ? weekdays.sort((a, b) => a - b).join(",") : "1";
        return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * ${days}`;
      }
      case "monthly":
        return `${parseInt(minute, 10)} ${parseInt(hour, 10)} ${dayOfMonth} * *`;
      case "custom":
        return customExpr;
    }
  }, [type, intervalValue, intervalUnit, hour, minute, weekdays, dayOfMonth, customExpr]);

  useEffect(() => {
    const cron = buildCron();
    if (type === "custom") {
      if (isValidCron(cron)) {
        setCustomError(null);
        onChange(cron);
      } else {
        setCustomError("Expressao cron invalida");
      }
    } else {
      onChange(cron);
    }
  }, [type, intervalValue, intervalUnit, hour, minute, weekdays, dayOfMonth, customExpr, buildCron, onChange]);

  const currentCron = buildCron();
  const description = describeCron(currentCron);
  const isValid = type !== "custom" || isValidCron(currentCron);
  const nextExecutions = useMemo(
    () => (isValid ? getNextExecutions(currentCron, 5) : []),
    [currentCron, isValid]
  );

  const handleTypeChange = (newType: string) => {
    setType(newType as ScheduleType);
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block text-sm font-medium">Tipo de agenda</Label>
        <RadioGroup value={type} onValueChange={handleTypeChange} className="flex flex-wrap gap-4">
          {[
            { value: "interval", label: "Intervalo" },
            { value: "daily", label: "Diario" },
            { value: "weekly", label: "Semanal" },
            { value: "monthly", label: "Mensal" },
            { value: "custom", label: "Personalizado" },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      {type === "interval" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">A cada</span>
          <Input
            type="number"
            min={1}
            max={intervalUnit === "minutes" ? 59 : 23}
            value={intervalValue}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n >= 1) setIntervalValue(n);
            }}
            className="w-20"
          />
          <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as "minutes" | "hours")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">minutos</SelectItem>
              <SelectItem value="hours">horas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {type === "daily" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Horario</span>
          <Input
            type="time"
            value={`${hour}:${minute}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":");
              setHour(h ?? "09");
              setMinute(m ?? "00");
            }}
            className="w-36"
          />
        </div>
      )}

      {type === "weekly" && (
        <div className="space-y-3">
          <div>
            <Label className="mb-2 block text-sm text-muted-foreground">Dias da semana</Label>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={weekdays.includes(day.value)}
                    onCheckedChange={() => toggleWeekday(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Horario</span>
            <Input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":");
                setHour(h ?? "09");
                setMinute(m ?? "00");
              }}
              className="w-36"
            />
          </div>
        </div>
      )}

      {type === "monthly" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Dia do mes</span>
            <Input
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 28) setDayOfMonth(n);
              }}
              className="w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Horario</span>
            <Input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":");
                setHour(h ?? "09");
                setMinute(m ?? "00");
              }}
              className="w-36"
            />
          </div>
        </div>
      )}

      {type === "custom" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="* * * * *"
              value={customExpr}
              onChange={(e) => setCustomExpr(e.target.value)}
              className={`w-48 font-mono ${customError ? "border-destructive" : ""}`}
            />
            {customError && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {customError}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Formato: minuto hora dia-do-mes mes dia-da-semana
          </p>
        </div>
      )}

      {isValid && description && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{description}</span>
          </div>
          {nextExecutions.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Proximas execucoes:</span>
              <div className="flex flex-wrap gap-1.5">
                {nextExecutions.map((date, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-normal">
                    {date.toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
