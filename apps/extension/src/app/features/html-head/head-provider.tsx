import { Link, HeadProvider as ReactHeadProvider, Title } from 'react-head';

export function HeadProvider() {
  return (
    <ReactHeadProvider>
      <Cat21MetaTags />
    </ReactHeadProvider>
  );
}

function Cat21MetaTags() {
  const suffix = process.env.WALLET_ENVIRONMENT === 'development' ? '-dev' : '';
  return (
    <>
      <Title>Cat21 Wallet</Title>
      <Link rel="icon" href={`/assets/icons/cat21-icon-128${suffix}.png`} />
    </>
  );
}
