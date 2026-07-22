import {
  Children, Fragment, forwardRef, isValidElement, useImperativeHandle, useMemo, useRef, useState,
  type ReactNode, type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { DropdownMenu, type MenuItem } from './overlays';
import { cn } from './util';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'multiple' | 'size'> & {
  children: ReactNode;
  invalid?: boolean;
};

type OptionDescriptor = {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
};

function textFromNode(node: ReactNode): string {
  return Children.toArray(node).map((part) => (
    typeof part === 'string' || typeof part === 'number' ? String(part) : ''
  )).join('').trim();
}

function readOptions(children: ReactNode): OptionDescriptor[] {
  const options: OptionDescriptor[] = [];
  const visit = (nodes: ReactNode, group?: string) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children, group);
        return;
      }
      if (child.type === 'optgroup') {
        const props = child.props as { label?: string; children?: ReactNode };
        visit(props.children, props.label);
        return;
      }
      if (child.type !== 'option') return;
      const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
      const label = textFromNode(props.children);
      options.push({
        value: String(props.value ?? label),
        label,
        disabled: Boolean(props.disabled),
        group,
      });
    });
  };
  visit(children);
  return options;
}

/** Select visual customizado: mantém um select nativo oculto para formulários e refs. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  children,
  invalid,
  className = '',
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  form,
  required,
  style,
  ...rest
}, forwardedRef) {
  const nativeRef = useRef<HTMLSelectElement>(null);
  useImperativeHandle(forwardedRef, () => nativeRef.current as HTMLSelectElement);
  const options = useMemo(() => readOptions(children), [children]);
  const initialValue = String(defaultValue ?? options.find((option) => !option.disabled)?.value ?? '');
  const [internalValue, setInternalValue] = useState(initialValue);
  const currentValue = String(value ?? internalValue);
  const selected = options.find((option) => option.value === currentValue) ?? options[0];

  const selectValue = (nextValue: string) => {
    if (disabled || nextValue === currentValue) return;
    setInternalValue(nextValue);
    const native = nativeRef.current;
    if (!native) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(native, nextValue);
    native.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const items: MenuItem[] = [];
  let currentGroup: string | undefined;
  options.forEach((option) => {
    if (option.group && option.group !== currentGroup) {
      if (items.length) items.push({ type: 'separator' });
      items.push({ type: 'label', label: option.group });
      currentGroup = option.group;
    }
    const isSelected = option.value === currentValue;
    items.push({
      label: option.label,
      selected: isSelected,
      disabled: option.disabled,
      icon: isSelected ? <Check className="h-4 w-4 text-brand" aria-hidden /> : <span className="h-4 w-4" aria-hidden />,
      onClick: () => selectValue(option.value),
    });
  });

  const ariaLabel = rest['aria-label'];
  const ariaLabelledBy = rest['aria-labelledby'];
  const ariaDescribedBy = rest['aria-describedby'];

  return (
    <>
      <DropdownMenu
        items={items}
        align="left"
        matchTriggerWidth
        trigger={({ toggle, ref: triggerRef, open }) => (
          <button
            ref={triggerRef}
            id={id}
            type="button"
            disabled={disabled}
            onClick={toggle}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={cn(
              'inline-flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--ma-r-md)] border border-line bg-panel-3 px-3 py-[9px] text-left text-sm text-fg outline-none',
              'transition-[border-color,box-shadow,background-color] duration-200 ease-ma hover:border-line-strong focus-visible:border-brand focus-visible:shadow-ma-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              invalid && 'border-danger focus-visible:border-danger',
              className,
            )}
          >
            <span className="min-w-0 flex-1 truncate">{selected?.label ?? 'Selecione'}</span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-3 transition-transform duration-150', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      />
      <select
        ref={nativeRef}
        name={name}
        form={form}
        value={currentValue}
        onChange={onChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    </>
  );
});
