import type { Ledger } from './managed/bboard/contract/index.js';
import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

export type BBoardPrivateState = {
  readonly advertiserMaxCPM: bigint;
  readonly publisherFloorCPM: bigint;
  readonly actualQuality: bigint;
};

export const createBBoardPrivateState = (
  advertiserMaxCPM: bigint,
  publisherFloorCPM: bigint,
  actualQuality: bigint,
): BBoardPrivateState => ({
  advertiserMaxCPM,
  publisherFloorCPM,
  actualQuality,
});

export const witnesses = {
  advertiserMaxCPM: ({ privateState }: WitnessContext<Ledger, BBoardPrivateState>): [BBoardPrivateState, bigint] => [
    privateState,
    privateState.advertiserMaxCPM,
  ],
  publisherFloorCPM: ({ privateState }: WitnessContext<Ledger, BBoardPrivateState>): [BBoardPrivateState, bigint] => [
    privateState,
    privateState.publisherFloorCPM,
  ],
  actualQuality: ({ privateState }: WitnessContext<Ledger, BBoardPrivateState>): [BBoardPrivateState, bigint] => [
    privateState,
    privateState.actualQuality,
  ],
};
