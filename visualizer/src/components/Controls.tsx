import React from 'react';

const Controls: React.FC = () => {
    const handleZoomIn = () => {
        // Logic for zooming in on the graph
    };

    const handleZoomOut = () => {
        // Logic for zooming out of the graph
    };

    const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        // Logic for filtering the graph based on selected criteria
    };

    return (
        <div className="controls">
            <button onClick={handleZoomIn}>Zoom In</button>
            <button onClick={handleZoomOut}>Zoom Out</button>
            <select onChange={handleFilterChange}>
                <option value="all">All</option>
                <option value="dependencies">Dependencies</option>
                <option value="services">Services</option>
            </select>
        </div>
    );
};

export default Controls;