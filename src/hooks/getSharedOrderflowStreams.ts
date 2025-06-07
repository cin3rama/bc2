// hooks/getSharedOrderflowStreams.ts (formerly getSharedOrderflowStreams.ts)
import { ReplaySubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const sharedMarketflow$ = new ReplaySubject<any>(1);
const sharedTradeflow$ = new ReplaySubject<any>(1);

/**
 * Returns shared observables wired to a source observable.
 */
export function getSharedOrderflowStreams(orderflow$: Observable<any>) {
    orderflow$.pipe(
        tap(data => {
            sharedMarketflow$.next(data);
            sharedTradeflow$.next(data);
        })
    ).subscribe(); // Only run once

    return {
        marketflow$: sharedMarketflow$.asObservable(),
        tradeflow$: sharedTradeflow$.asObservable(),
    };
}
