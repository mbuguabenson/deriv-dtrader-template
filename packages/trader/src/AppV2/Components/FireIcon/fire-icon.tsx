import './fire-icon.scss';

const FireIcon = () => (
    <span className='fire-icon' aria-hidden='true'>
        <svg
            className='fire-icon__flame'
            viewBox='0 0 24 24'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
        >
            <path
                d='M12 2C12 2 8 7 8 12a4 4 0 0 0 8 0c0-2-1-4-1-4s2 2 2 5a5 5 0 0 1-10 0c0-5 5-11 5-11z'
                fill='#FF6600'
            />
            <path
                d='M12 8c0 0-2 3-2 5a2 2 0 0 0 4 0c0-1.5-1-3-1-3s1 1.5 1 3a1 1 0 0 1-2 0c0-2 2-5 2-5-1 0-2 0-2 0z'
                fill='#FFAA00'
            />
        </svg>
    </span>
);

export default FireIcon;
