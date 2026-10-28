import {
  useForm,
  type UseFormRegister,
  type FieldValues,
} from "react-hook-form";
import type { JsonSchema } from "@/types/mcp";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/react";
function Field({
  name,
  schema,
  required,
  register,
  depth = 0,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
  register: UseFormRegister<FieldValues>;
  depth?: number;
}) {
  const { t } = useI18n();
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;
  if (depth > 8) return <p>{t("Nested schema: use the JSON editor.")}</p>;
  if (type === "object" || schema.properties)
    return (
      <fieldset className="schema-group">
        <legend>
          {name || t("Arguments")}
          {required ? " *" : ""}
        </legend>
        {Object.entries(schema.properties ?? {}).map(([key, s]) =>
          /[.[\]]/.test(key) ||
          ["__proto__", "constructor", "prototype"].includes(key) ? (
            <p className="muted" key={key}>
              {t(
                'Edit property "{name}" in JSON to preserve its literal name.',
                { name: key },
              )}
            </p>
          ) : (
            <Field
              key={key}
              name={name ? name + "." + key : key}
              schema={s}
              required={schema.required?.includes(key) ?? false}
              register={register}
              depth={depth + 1}
            />
          ),
        )}
      </fieldset>
    );
  const opts = {
    required,
    setValueAs: (value: unknown) => {
      if (value === "") return undefined;
      if (type === "integer" || type === "number") return Number(value);
      if (type === "array") {
        try {
          return JSON.parse(String(value));
        } catch {
          return value;
        }
      }
      if (schema.enum) {
        try {
          return JSON.parse(String(value));
        } catch {
          return value;
        }
      }
      return value;
    },
  };
  return (
    <label className="field">
      <span>
        {name.split(".").at(-1)}
        {required && <b className="accent"> *</b>}{" "}
        <small>{type ?? "JSON"}</small>
      </span>
      {schema.enum ? (
        <select {...register(name, opts)}>
          <option value="">{t("Select…")}</option>
          {schema.enum.map((v, i) => (
            <option key={i} value={JSON.stringify(v)}>
              {String(v)}
            </option>
          ))}
        </select>
      ) : type === "boolean" ? (
        <input type="checkbox" {...register(name)} />
      ) : type === "array" ? (
        <textarea rows={3} placeholder="[]" {...register(name, opts)} />
      ) : (
        <input
          type={type === "number" || type === "integer" ? "number" : "text"}
          step={type === "integer" ? 1 : "any"}
          {...register(name, opts)}
        />
      )}
      <small>{schema.description}</small>
    </label>
  );
}
export function SchemaForm({
  schema,
  onApply,
}: {
  schema: JsonSchema;
  onApply: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  return (
    <form onSubmit={handleSubmit(onApply)}>
      <Field name="" schema={schema} required={false} register={register} />
      {Object.keys(errors).length > 0 && (
        <p className="error">{t("Complete required fields.")}</p>
      )}
      <Button type="submit" variant="secondary" size="sm">
        {t("Apply to JSON editor")}
      </Button>
      <p className="muted tiny">
        {t(
          "JSON Schema remains authoritative. Use JSON for unions, references and complex array items.",
        )}
      </p>
    </form>
  );
}
