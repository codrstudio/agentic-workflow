# Form API Reference

shadcn/ui v4 provides two approaches to forms:

1. **Field component** (recommended) -- composable primitives for building forms with any form library
2. **Form component** (legacy) -- wrapper around react-hook-form with built-in accessibility

## Field Component (Recommended)

Install: `npx shadcn@latest add field`

```tsx
import {
  Field, FieldContent, FieldDescription, FieldError,
  FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle,
} from "@/components/ui/field"
```

### Anatomy

```tsx
<FieldSet>
  <FieldLegend>Section Title</FieldLegend>
  <FieldDescription>Section description.</FieldDescription>
  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="name">Name</FieldLabel>
      <Input id="name" />
      <FieldDescription>Helper text.</FieldDescription>
    </Field>
    <Field data-invalid>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" aria-invalid />
      <FieldError>Invalid email.</FieldError>
    </Field>
  </FieldGroup>
</FieldSet>
```

### Field Props

| Prop | Type | Default |
|------|------|---------|
| `orientation` | `"vertical" \| "horizontal" \| "responsive"` | `"vertical"` |
| `data-invalid` | `boolean` | - |

### FieldLegend Props

| Prop | Type | Default |
|------|------|---------|
| `variant` | `"legend" \| "label"` | `"legend"` |

### FieldLabel Props

| Prop | Type | Default |
|------|------|---------|
| `asChild` | `boolean` | `false` |
| `htmlFor` | `string` | - |

### FieldContent Props

Flex column that groups label and description when control sits beside them. Not required if no description.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldTitle Props

Renders a title with label styling inside `FieldContent`.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldDescription Props

Helper text slot that auto-balances long lines in horizontal layouts.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldSeparator Props

Visual divider between sections. Accepts optional inline content as children.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldGroup Props

Layout wrapper that stacks `Field` components. Enables container queries with `@container/field-group`.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldSet Props

Semantic `fieldset` container with spacing presets.

| Prop | Type | Default |
|------|------|---------|
| `className` | `string` | - |

### FieldError Props

| Prop | Type | Default |
|------|------|---------|
| `errors` | `Array<{ message?: string } \| undefined>` | - |

Accepts errors from react-hook-form (`fieldState.error`), TanStack Form (`field.state.meta.errors`), or any Standard Schema validator (Zod, Valibot, ArkType). Renders a list when multiple messages are present.

### Validation Pattern

```tsx
<Field data-invalid={fieldState.invalid}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid={fieldState.invalid} />
  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
</Field>
```

## React Hook Form Integration

Dependencies:
```bash
npm install react-hook-form @hookform/resolvers zod
```

### Setup Pattern

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(20).max(100),
})

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    console.log(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Title</FieldLabel>
            <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Validation Modes

```tsx
const form = useForm({
  resolver: zodResolver(formSchema),
  mode: "onChange",  // "onChange" | "onBlur" | "onSubmit" | "onTouched" | "all"
})
```

| Mode | Description |
|------|-------------|
| `onChange` | Validates on every change |
| `onBlur` | Validates on blur |
| `onSubmit` | Validates on submit (default) |
| `onTouched` | Validates on first blur, then on every change |
| `all` | Validates on blur and change |

### Field Type Patterns

**Input:** Spread `field` onto `<Input>`:
```tsx
<Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
```

**Select:** Use `field.value` and `field.onChange`:
```tsx
<Select name={field.name} value={field.value} onValueChange={field.onChange}>
  <SelectTrigger aria-invalid={fieldState.invalid}><SelectValue /></SelectTrigger>
  <SelectContent><SelectItem value="en">English</SelectItem></SelectContent>
</Select>
```

**Checkbox (array):** Manual array manipulation:
```tsx
<Checkbox
  checked={field.value.includes(itemId)}
  onCheckedChange={(checked) => {
    const newValue = checked ? [...field.value, itemId] : field.value.filter((v) => v !== itemId)
    field.onChange(newValue)
  }}
/>
```

**Switch:** Use `field.value` as `checked`:
```tsx
<Switch name={field.name} checked={field.value} onCheckedChange={field.onChange} />
```

**Radio Group:**
```tsx
<RadioGroup name={field.name} value={field.value} onValueChange={field.onChange}>
  <RadioGroupItem value="option1" />
</RadioGroup>
```

### Array Fields (useFieldArray)

```tsx
import { useFieldArray, useForm } from "react-hook-form"

const form = useForm({ /* ... */ })
const { fields, append, remove } = useFieldArray({ control: form.control, name: "emails" })

// Map over fields
{fields.map((field, index) => (
  <Controller key={field.id} name={`emails.${index}.address`} control={form.control} render={/* ... */} />
))}

// Add/remove
<Button onClick={() => append({ address: "" })}>Add</Button>
<Button onClick={() => remove(index)}>Remove</Button>
```

### Reset

```tsx
<Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
```

## TanStack Form Integration

Dependencies:
```bash
npm install @tanstack/react-form zod
```

### Setup Pattern

```tsx
import { useForm } from "@tanstack/react-form"
import * as z from "zod"

const formSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20).max(100),
})

export function MyForm() {
  const form = useForm({
    defaultValues: { title: "", description: "" },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => { console.log(value) },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field
        name="title"
        children={(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Title</FieldLabel>
              <Input
                id={field.name} name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Key Differences from React Hook Form

| Feature | React Hook Form | TanStack Form |
|---------|----------------|---------------|
| Field wrapper | `<Controller>` | `<form.Field>` |
| Error check | `fieldState.invalid` | `field.state.meta.isTouched && !field.state.meta.isValid` |
| Error data | `fieldState.error` | `field.state.meta.errors` |
| Value binding | `{...field}` spread | `value={field.state.value}` + `onChange` handler |
| Validation config | `resolver: zodResolver(schema)` | `validators: { onSubmit: schema }` |
| Submit handler | `form.handleSubmit(onSubmit)` | `e.preventDefault(); form.handleSubmit()` |

### Validation Modes

```tsx
const form = useForm({
  validators: {
    onSubmit: formSchema,
    onChange: formSchema,
    onBlur: formSchema,
  },
})
```

| Mode | Description |
|------|-------------|
| `onChange` | Validates on every change |
| `onBlur` | Validates on blur |
| `onSubmit` | Validates on submit |

### Field Type Patterns

**Input:**
```tsx
value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)}
```

**Select:**
```tsx
value={field.state.value} onValueChange={field.handleChange}
```

**Checkbox (array):** Use `mode="array"` on `<form.Field>`:
```tsx
<form.Field name="tasks" mode="array" children={(field) => {
  // Use field.pushValue(id) to add, field.removeValue(index) to remove
  checked={field.state.value.includes(taskId)}
  onCheckedChange={(checked) => {
    if (checked) field.pushValue(taskId)
    else { const i = field.state.value.indexOf(taskId); if (i > -1) field.removeValue(i) }
  }}
}} />
```

**Switch:**
```tsx
checked={field.state.value} onCheckedChange={field.handleChange}
```

### Array Fields

Use `mode="array"` and bracket notation for nested fields:

```tsx
<form.Field name="emails" mode="array" children={(field) => (
  <FieldGroup>
    {field.state.value.map((_, index) => (
      <form.Field key={index} name={`emails[${index}].address`} children={(subField) => /* ... */} />
    ))}
  </FieldGroup>
)} />

// Add: field.pushValue({ address: "" })
// Remove: field.removeValue(index)
```

### Reset

```tsx
<Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
```

## Zod Schema Patterns

```tsx
import * as z from "zod"

// Basic
const schema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email("Invalid email"),
  age: z.coerce.number().min(18),
})

// Optional fields
const schema = z.object({
  bio: z.string().optional(),
})

// Enum / union
const schema = z.object({
  role: z.enum(["admin", "user", "moderator"]),
})

// Array validation
const schema = z.object({
  emails: z.array(
    z.object({ address: z.string().email("Enter a valid email.") })
  ).min(1, "At least one email.").max(5, "Up to 5 emails."),
})

// Checkbox array (string array)
const schema = z.object({
  tasks: z.array(z.string()).min(1, "Select at least one task."),
})
```

## Legacy Form Component

Install: `npx shadcn@latest add form`

Dependencies: `react-hook-form @hookform/resolvers zod @radix-ui/react-label @radix-ui/react-slot`

This is an older abstraction over react-hook-form. For new projects, prefer the Field component.

### Anatomy

```
Form                    -- wraps FormProvider from react-hook-form
  FormField             -- wraps Controller, provides FormFieldContext
    FormItem            -- layout wrapper, provides FormItemContext (generates unique id)
      FormLabel         -- auto-connects to control via useFormField
      FormControl       -- applies aria-describedby, aria-invalid from form state
        {control}       -- your input component
      FormDescription   -- helper text, linked via aria-describedby
      FormMessage       -- displays validation error, linked via aria-describedby
```

### Usage

```tsx
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input placeholder="shadcn" {...field} />
          </FormControl>
          <FormDescription>Your public display name.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>
```

### useFormField Hook

Returns form field state from the `FormFieldContext` and `FormItemContext`. Used internally by `FormLabel`, `FormControl`, `FormDescription`, and `FormMessage`.

```tsx
const { id, name, formItemId, formDescriptionId, formMessageId, error } = useFormField()
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique form item ID |
| `name` | `string` | Field name from react-hook-form |
| `formItemId` | `string` | ID for the form control (`{id}-form-item`) |
| `formDescriptionId` | `string` | ID for description (`{id}-form-item-description`) |
| `formMessageId` | `string` | ID for error message (`{id}-form-item-message`) |
| `error` | `FieldError \| undefined` | Current validation error |

### Component Details

| Component | Renders | Key Behavior |
|-----------|---------|-------------|
| `Form` | `<FormProvider>` | Spreads form methods into context |
| `FormField` | `<Controller>` | Provides field name via `FormFieldContext` |
| `FormItem` | `<div>` | Generates unique `id` via `React.useId()` |
| `FormLabel` | `<Label>` | Sets `htmlFor` to `formItemId`, adds error styling |
| `FormControl` | `<Slot>` | Sets `id`, `aria-describedby`, `aria-invalid` on child |
| `FormDescription` | `<p>` | Muted helper text with `id={formDescriptionId}` |
| `FormMessage` | `<p>` | Displays `error.message` or children, `id={formMessageId}` |
