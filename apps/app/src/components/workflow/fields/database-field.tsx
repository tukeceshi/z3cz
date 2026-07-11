import { useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDatabase, useDatabases } from "@/services/database-service";
import { cn } from "@/utils/utils";

import type { FieldProps } from "./types";

const CREATE_NEW = "__create_new__";

export function DatabaseField({
  className,
  connected,
  disabled,
  onChange,
  value,
}: FieldProps) {
  const { t } = useTranslation();
  const { databases, isDatabasesLoading, mutateDatabases } = useDatabases();
  const { organization } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const stringValue = String(value ?? "");

  const handleChange = (val: string) => {
    if (val === CREATE_NEW) {
      setIsCreateDialogOpen(true);
      return;
    }
    onChange(val || undefined);
  };

  const handleCreate = async (name: string) => {
    if (!organization?.id) return;
    const response = await createDatabase({ name }, organization.id);
    await mutateDatabases();
    onChange(response.id);
    setIsCreateDialogOpen(false);
  };

  if (disabled) {
    const label = databases?.find((d) => d.id === stringValue)?.name ?? "";
    return (
      <div className={cn("relative", className)}>
        <Select value={stringValue} disabled>
          <SelectTrigger>
            <SelectValue
              placeholder={
                connected
                  ? t("workflow.fields.connected")
                  : label || t("workflow.fields.database.none")
              }
            >
              {connected
                ? t("workflow.fields.connected")
                : label || t("workflow.fields.database.none")}
            </SelectValue>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Select
        value={stringValue}
        onValueChange={handleChange}
        disabled={isDatabasesLoading}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              connected
                ? t("workflow.fields.connected")
                : isDatabasesLoading
                  ? t("common.loading")
                  : databases?.length === 0
                    ? t("workflow.fields.database.empty")
                    : t("workflow.fields.database.select")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {databases?.map((database) => (
            <SelectItem
              key={database.id}
              value={database.id}
              className="text-xs"
            >
              {database.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CREATE_NEW} className="text-xs">
            {t("workflow.fields.database.new")}
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.databases.createDialogTitle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get("name") as string;
              await handleCreate(name);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">{t("pages.databases.databaseName")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t("workflow.fields.database.enterName")}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit">{t("pages.databases.createDatabase")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
