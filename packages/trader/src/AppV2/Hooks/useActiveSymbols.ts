import { useCallback, useEffect } from 'react';

import { TActiveSymbolsRequest, useQuery } from '@deriv/api';
import { CONTRACT_TYPES, getContractTypesConfig } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import { localize } from '@deriv-com/translations';

import { useTraderStore } from 'Stores/useTraderStores';

type TContractTypesList = NonNullable<TActiveSymbolsRequest['contract_type']>;

// Cache configuration for active symbols query
const ACTIVE_SYMBOLS_CACHE_CONFIG = {
    CACHE_TIME: 10 * 60 * 1000, // 10 minutes - keep in cache even if unused
} as const;

/**
 * Hook to fetch and manage active symbols for trading
 */
const useActiveSymbols = () => {
    const { common } = useStore();
    const { showError } = common;
    const {
        contract_type,
        is_vanilla,
        is_turbos,
        setActiveSymbolsV2,
        active_symbols: currentSymbols,
    } = useTraderStore();

    const getContractTypesList = (): TContractTypesList => {
        if (is_turbos) return [CONTRACT_TYPES.TURBOS.LONG, CONTRACT_TYPES.TURBOS.SHORT] as TContractTypesList;
        if (is_vanilla) return [CONTRACT_TYPES.VANILLA.CALL, CONTRACT_TYPES.VANILLA.PUT] as TContractTypesList;
        return (getContractTypesConfig()[contract_type]?.trade_types ?? []) as TContractTypesList;
    };

    const {
        data: response,
        error: queryError,
        isLoading,
    } = useQuery('active_symbols', {
        payload: {
            active_symbols: 'brief',
            contract_type: getContractTypesList(),
        },
        options: {
            cacheTime: ACTIVE_SYMBOLS_CACHE_CONFIG.CACHE_TIME,
            staleTime: 5 * 60 * 1000,
            retry: 3,
        },
    });

    // Handle query errors non-fatally to avoid disrupting active trading sessions
    useEffect(() => {
        if (queryError) {
            // eslint-disable-next-line no-console
            console.warn('[useActiveSymbols] Background error loading active symbols:', queryError);
        }
    }, [queryError]);

    // Update MobX store when data is received (for trade-store internal operations)
    useEffect(() => {
        if (!response) return;

        const { active_symbols = [] } = response;

        if (active_symbols?.length) {
            // Update store with fresh data
            setActiveSymbolsV2(active_symbols);
        } else if (!currentSymbols?.length) {
            // eslint-disable-next-line no-console
            console.warn('[useActiveSymbols] Empty active symbols returned from query');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response]);

    return {
        activeSymbols: response?.active_symbols || [],
        isLoading,
    };
};

export default useActiveSymbols;
