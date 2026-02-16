import React, { useEffect, useState } from 'react';
import { Graph } from 'react-d3-graph';

const GraphView = () => {
    const [data, setData] = useState({ nodes: [], links: [] });

    useEffect(() => {
        fetch('/api/graph-data')
            .then(response => response.json())
            .then(graphData => setData(graphData))
            .catch(error => console.error('Error fetching graph data:', error));
    }, []);

    const graphConfig = {
        node: {
            color: 'lightblue',
            size: 200,
            highlightStrokeColor: 'blue',
        },
        link: {
            highlightColor: 'lightblue',
        },
    };

    return (
        <div>
            <h2>Microservices Dependency Graph</h2>
            <Graph
                id="graph-id"
                data={data}
                config={graphConfig}
                onClickNode={nodeId => console.log(`Clicked node ${nodeId}`)}
                onClickLink={(source, target) => console.log(`Clicked link between ${source} and ${target}`)}
            />
        </div>
    );
};

export default GraphView;