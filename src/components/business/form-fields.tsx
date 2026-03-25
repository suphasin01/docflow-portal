import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BaseFieldProps = {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function FormInputField({
  label,
  value,
  error,
  onChange,
  type = "text",
}: BaseFieldProps & { type?: string }) {
  return (
    <div className="space-y-2">
      <Label className="pt-0.5 leading-relaxed">{label}</Label>
      <Input
        type={type}
        className="rounded-xl focus-visible:ring-2 focus-visible:ring-inset"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FormFieldError message={error} />
    </div>
  );
}

export function FormTextareaField({
  label,
  value,
  error,
  onChange,
}: BaseFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="pt-0.5 leading-relaxed">{label}</Label>
      <Textarea
        className="min-h-[86px] rounded-xl focus-visible:ring-2 focus-visible:ring-inset"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FormFieldError message={error} />
    </div>
  );
}

export function FormFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
