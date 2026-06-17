import { styled } from 'leather-styles/jsx';
import { HTMLStyledProps } from 'leather-styles/types';
import { ImageSizeProps } from '~/utils/types';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- HACK: leather-styles codegen not produced for web in Cat21 wallet (apps/web is non-shipping).
export function SbtcLogo(props: HTMLStyledProps<'img'> & ImageSizeProps) {
  return (
    <styled.img
      width={props.size ?? props.width}
      height={props.size ?? props.height}
      src="/icons/sbtc.svg"
      alt="Sbtc Logo"
      {...props}
    />
  );
}
