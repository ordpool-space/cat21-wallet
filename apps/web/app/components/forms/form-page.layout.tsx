import { ReactElement } from 'react';

import { Box, Flex, FlexProps } from 'leather-styles/jsx';

type Slots = 'preview' | 'form';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- HACK: leather-styles codegen not produced for web in Cat21 wallet (apps/web is non-shipping).
type FormLayoutProps = Record<Slots, ReactElement> & FlexProps;

export function FormPageLayout(props: FormLayoutProps) {
  const { preview, form, ...rest } = props;
  return (
    <Flex
      flexDirection={['column', null, null, 'row']}
      justifyContent="center"
      alignItems="flex-start"
      {...rest}
    >
      <Box
        maxWidth={[null, null, null, '380px', '500px']}
        mr={[null, null, null, 'space.05', 'space.08']}
      >
        {form}
      </Box>
      {preview}
    </Flex>
  );
}
