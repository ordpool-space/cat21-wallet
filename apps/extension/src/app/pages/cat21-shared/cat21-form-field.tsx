import { type ChangeEvent } from 'react';

import { Flex, styled } from 'leather-styles/jsx';

import { ErrorLabel } from '@app/components/error-label';

/**
 * Shared form field for the four cat21 form pages (mint / transfer /
 * create-offer / agent-policy wizard). The superset shape supports
 * a plain text/number input, a multi-line textarea, and a checkbox.
 *
 * Kept in `pages/cat21-shared/` because all four forms have the same
 * visual language and the label / error / border styling stays
 * identical across them. A divergence will require splitting; today
 * the unified shape is the right level of abstraction.
 */
interface Cat21FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'checkbox';
  as?: 'textarea';
  value?: string;
  checked?: boolean;
  onChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void;
  error?: string;
}

export function Cat21FormField(props: Cat21FormFieldProps) {
  const { label, name, type, as, value, checked, onChange, error } = props;
  return (
    <Flex direction="column" gap="space.01">
      <styled.label htmlFor={name} textStyle="label.02">
        {label}
      </styled.label>
      {as === 'textarea' ? (
        <styled.textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          rows={3}
          width="100%"
          padding="space.02"
          borderColor="ink.border-default"
          borderWidth="1px"
          borderRadius="xs"
        />
      ) : (
        <styled.input
          id={name}
          name={name}
          type={type ?? 'text'}
          value={type === 'checkbox' ? undefined : value}
          checked={type === 'checkbox' ? checked : undefined}
          onChange={onChange}
          padding="space.02"
          borderColor="ink.border-default"
          borderWidth="1px"
          borderRadius="xs"
        />
      )}
      {error ? <ErrorLabel>{error}</ErrorLabel> : null}
    </Flex>
  );
}
