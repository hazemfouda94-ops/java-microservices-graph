import React from 'react';
import GraphView from './components/GraphView';
import Controls from './components/Controls';
import './styles/main.css';

const App: React.FC = () => {
    return (
        <div className="app">
            <h1>Microservices Dependency Graph</h1>
            <Controls />
            <GraphView />
        </div>
    );
};

export default App;