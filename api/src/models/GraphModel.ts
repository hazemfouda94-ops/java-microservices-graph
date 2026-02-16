type GraphNode = Record<string, unknown>;
type GraphEdge = Record<string, unknown>;

export class GraphModel {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];

  getNodes(): GraphNode[] {
    return this.nodes;
  }

  getEdges(): GraphEdge[] {
    return this.edges;
  }

  getDependencies(serviceName: string): GraphEdge[] {
    return this.edges.filter(
      (edge) => edge.source === serviceName || edge.from === serviceName
    );
  }

  addNode(node: GraphNode): void {
    this.nodes.push(node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }
}
