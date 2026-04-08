# Candidate Instructions

## Objective

Implement dynamic house edge logic in `EthexLoto` and make all tests in `test/CandidateDynamicHouseEdge.test.js` pass.

## Rules

- Do not change the public interface unless needed.
- Keep `JACKPOT_PERCENT` behavior unchanged.
- Keep jackpot registration and settlement behavior unchanged.
- Do not modify the new candidate test file expectations.
- Keep Solidity version `0.5.10`.

## Required Logic

Compute house edge by number of marked cells in a bet:

- 1 marked cell -> 12%
- 2-3 marked cells -> 10%
- 4-6 marked cells -> 8%

"Marked cell" means a valid selected bet slot (same concept already used in the contract).

## Acceptance Criteria

- House contract receives the correct dynamic fee.
- Net bet amount reflects dynamic fee deduction.
- Expired bet refunds use dynamic fee deduction.
- Candidate test suite passes.

## Commands

Install dependencies:

```bash
npm install
```

Run only the candidate suite:

```bash
npx truffle test test/CandidateDynamicHouseEdgeTests.js
```

Run all tests:

```bash
npx truffle test
```

## Deliverables

1. Contract changes.
2. Passing tests.
3. Short note (2-4 bullets) describing:
   - what you changed,
   - why the change is safe,
   - any edge cases considered.
