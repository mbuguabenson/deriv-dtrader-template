import React from 'react';
import classNames from 'classnames';

type TLastDigitPointer = {
    is_lost?: boolean;
    is_trade_page?: boolean;
    is_won?: boolean;
    position?: {
        left: number;
        top: number;
    };
};

const LastDigitPointer = ({ is_lost, is_trade_page, is_won, position }: TLastDigitPointer) => (
    <React.Fragment>
        {!!position && (
            <span
                className='digits__pointer'
                style={{ transform: `translate3d(calc(${position.left}px), ${position.top}px, 0px)` }}
            >
                <svg
                    width='16'
                    height='16'
                    viewBox='0 0 16 16'
                    className={classNames('digits__icon', {
                        'digits__icon--win': is_won && !is_trade_page,
                        'digits__icon--loss': is_lost && !is_trade_page,
                    })}
                >
                    <path
                        d='m8 4 6 8H2z'
                        fill={
                            is_won && !is_trade_page
                                ? 'var(--color-text-success, #00a79e)'
                                : is_lost && !is_trade_page
                                  ? 'var(--color-text-danger, #cc2e3d)'
                                  : 'var(--brand-orange, #ff444f)'
                        }
                    />
                </svg>
            </span>
        )}
    </React.Fragment>
);

export default LastDigitPointer;
