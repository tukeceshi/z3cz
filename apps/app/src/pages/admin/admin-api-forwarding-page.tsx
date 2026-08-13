import { useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { toast } from "sonner";



import { AdminApiForwardingCreateDialog } from "@/pages/admin/admin-api-forwarding-create-dialog";

import { InsetError } from "@/components/inset-error";

import { InsetLoading } from "@/components/inset-loading";

import { InsetLayout } from "@/components/layouts/inset-layout";

import { useTranslation } from "@/components/locale-provider";

import { useBreadcrumbsSetter } from "@/components/page-context";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import {

  Table,

  TableBody,

  TableCell,

  TableHead,

  TableHeader,

  TableRow,

} from "@/components/ui/table";

import {

  deleteAdminFormatTransformTemplate,

  useAdminFormatTransformTemplates,

} from "@/services/admin-format-transform-service";



export function AdminApiForwardingPage() {

  const { t } = useTranslation();

  const navigate = useNavigate();

  const { templates, templatesError, isTemplatesLoading, refreshTemplates } =

    useAdminFormatTransformTemplates();

  const [createOpen, setCreateOpen] = useState(false);



  const setBreadcrumbs = useBreadcrumbsSetter();



  useEffect(() => {

    setBreadcrumbs([{ label: t("adminApiForwarding.title") }]);

    return () => setBreadcrumbs([]);

  }, [setBreadcrumbs, t]);



  const handleDelete = async (id: string) => {

    if (!window.confirm(t("adminApiForwarding.deleteConfirm"))) {

      return;

    }



    try {

      await deleteAdminFormatTransformTemplate(id);

      toast.success(t("adminApiForwarding.deleteSuccess"));

      await refreshTemplates();

    } catch (error) {

      toast.error(

        error instanceof Error ? error.message : t("adminApiForwarding.deleteError")

      );

    }

  };



  if (isTemplatesLoading) {

    return <InsetLoading />;

  }



  if (templatesError) {

    return (

      <InsetError

        errorMessage={t("adminApiForwarding.loadError")}

      />

    );

  }



  return (

    <InsetLayout

      title={t("adminApiForwarding.title")}

      titleRight={

        <Button onClick={() => setCreateOpen(true)}>

          {t("adminApiForwarding.create")}

        </Button>

      }

    >

      <p className="mb-6 text-sm text-muted-foreground">

        {t("adminApiForwarding.description")}

      </p>

      <Table>

        <TableHeader>

          <TableRow>

            <TableHead>{t("adminApiForwarding.columns.name")}</TableHead>

            <TableHead>{t("adminApiForwarding.columns.provider")}</TableHead>

            <TableHead>{t("adminApiForwarding.columns.status")}</TableHead>

            <TableHead className="text-right">

              {t("adminApiForwarding.columns.actions")}

            </TableHead>

          </TableRow>

        </TableHeader>

        <TableBody>

          {templates.length === 0 ? (

            <TableRow>

              <TableCell colSpan={4} className="text-center text-muted-foreground">

                {t("adminApiForwarding.empty")}

              </TableCell>

            </TableRow>

          ) : (

            templates.map((template) => (

              <TableRow key={template.id}>

                <TableCell className="align-top font-medium">{template.name}</TableCell>

                <TableCell className="align-top">{template.provider}</TableCell>

                <TableCell className="align-top">

                  {template.enabled ? (

                    <Badge>{t("adminApiForwarding.enabled")}</Badge>

                  ) : (

                    <Badge variant="secondary">

                      {t("adminApiForwarding.disabled")}

                    </Badge>

                  )}

                </TableCell>

                <TableCell className="align-top text-right">

                  <div className="flex justify-end gap-2">

                    <Button

                      variant="outline"

                      size="sm"

                      onClick={() => navigate(`/admin/format-templates/${template.id}`)}

                    >

                      {t("common.edit")}

                    </Button>

                    <Button

                      variant="ghost"

                      size="sm"

                      onClick={() => void handleDelete(template.id)}

                    >

                      {t("common.delete")}

                    </Button>

                  </div>

                </TableCell>

              </TableRow>

            ))

          )}

        </TableBody>

      </Table>



      <AdminApiForwardingCreateDialog

        open={createOpen}

        onOpenChange={setCreateOpen}

        onCreated={refreshTemplates}

      />

    </InsetLayout>

  );

}

