"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export type StudentFormValues = {
  name: string;
  seatNumber: string;
};

type StudentFormCardProps = {
  title: string;
  description?: string;
  values: StudentFormValues;
  submitLabel: string;
  onChange: (values: StudentFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  pending?: boolean;
  error?: string | null;
};

export function StudentFormCard({
  title,
  description,
  values,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
  pending,
  error,
}: StudentFormCardProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          座號
          <input
            type="number"
            min={1}
            step={1}
            required
            value={values.seatNumber}
            onChange={(event) =>
              onChange({ ...values, seatNumber: event.target.value })
            }
            className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          姓名
          <input
            type="text"
            required
            value={values.name}
            onChange={(event) =>
              onChange({ ...values, name: event.target.value })
            }
            className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "處理中…" : submitLabel}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onCancel}
            >
              取消
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
