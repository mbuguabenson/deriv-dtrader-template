import React from 'react';

import FullscreenError from '../fullscreen-error';
import PageError from '../page-error';

type TPageErrorContainer = {
    buttonOnClick?: () => void;
    error_header?: React.ReactNode;
    error_messages?: Array<{ message: string; has_html?: boolean } | React.ReactNode>;
    redirect_labels: string[];
    redirect_urls?: string[];
    setError?: (has_error: boolean, error: React.ReactNode) => void;
    should_clear_error_on_click?: boolean;
};

const PageErrorContainer = ({ error_header, error_messages, ...props }: TPageErrorContainer) => {
    const hasMessages = error_messages && error_messages.length > 0;
    let errorMessage: string | undefined;
    if (hasMessages) {
        const firstMessage = error_messages[0];
        if (typeof firstMessage === 'string') {
            errorMessage = firstMessage;
        } else if (firstMessage && typeof firstMessage === 'object') {
            if ('message' in firstMessage && typeof (firstMessage as any).message === 'string') {
                errorMessage = (firstMessage as any).message;
            } else if ('props' in firstMessage && (firstMessage as any).props?.i18n_default_text) {
                errorMessage = (firstMessage as any).props.i18n_default_text;
            }
        }
    }

    // Full page error with messages (e.g., 404, specific page errors, error notifications)
    if (error_header && hasMessages) {
        return <PageError header={error_header} messages={error_messages} {...props} />;
    }

    // Uncaught errors from ErrorBoundary or missing header → show fullscreen error with extracted error message
    return <FullscreenError error_message={errorMessage} />;
};

export default PageErrorContainer;
