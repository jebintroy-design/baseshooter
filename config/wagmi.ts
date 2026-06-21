import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { baseAccount, injected } from 'wagmi/connectors';

// EIP-6963 (default-on multiInjectedProviderDiscovery) auto-registers MetaMask, Rabby,
// and any other compliant extension. `injected()` is a generic fallback for legacy wallets
// that only inject window.ethereum without EIP-6963 announcements.
export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({ appName: 'Baseshooter' }),
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http('https://mainnet.base.org'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
