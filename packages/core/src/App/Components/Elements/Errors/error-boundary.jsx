import PropTypes from 'prop-types';
import React from 'react';
import ErrorComponent from './index';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    componentDidCatch = (error, info) => {
        // eslint-disable-next-line no-console
        console.error('[DTrader ErrorBoundary caught error]:', error, info);
        this.setState({
            hasError: true,
            error,
            info,
        });
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null, info: null });
    };

    render = () => {
        if (this.state.hasError) {
            return (
                <ErrorComponent
                    header='An unexpected error occurred'
                    message={
                        this.state.error?.message || "We're sorry for the disruption. Please click Retry to continue."
                    }
                    redirect_label='Retry'
                    redirectOnClick={this.handleRetry}
                    should_show_refresh={true}
                />
            );
        }
        return this.props.children;
    };
}

ErrorBoundary.propTypes = {
    root_store: PropTypes.object,
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

export default ErrorBoundary;
